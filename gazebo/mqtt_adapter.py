"""Opt-in simulator lane on the existing MAR MQTT broker; never real MOVE topics."""
import json
import os
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse
import paho.mqtt.client as mqtt
from bridge_contract import validate_run

def stamp():
    return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')

class SimulationMqttAdapter:
    def __init__(self,node):
        self.node=node
        self.robot_id=str(uuid.UUID(os.environ.get('SIM_ROBOT_ID','9cd72e40-5778-4ee8-b5c3-e1030089e3a1')))
        self.prefix=f'mar/robots/{self.robot_id}/simulation/'
        self.session=str(uuid.uuid4())
        self.sequence=0
        self.connected=False
        self.seen={}
        self.next_publish=0
        uri=urlparse(os.environ['MQTT_BROKER_URI'])
        if uri.scheme != 'ssl':
            raise ValueError('Simulator requires the existing TLS MQTT broker')
        self.client=mqtt.Client(client_id='mar-sim-'+self.session[:12],protocol=mqtt.MQTTv5)
        self.client.username_pw_set(os.environ['MQTT_USERNAME'],os.environ['MQTT_PASSWORD'])
        self.client.tls_set()
        self.client.reconnect_delay_set(1,5)
        self.client.on_connect=self.on_connect
        self.client.on_subscribe=self.on_subscribe
        self.client.on_disconnect=lambda *_:setattr(self,'connected',False)
        self.client.on_message=self.on_message
        self.client.connect_async(uri.hostname,uri.port or 8883,keepalive=10)
        self.client.loop_start()

    def on_connect(self,client,userdata,flags,rc,properties=None):
        if getattr(rc,"value",rc)!=0:return
        # retainAsPublished preserves the retained flag for rejection.
        client.subscribe(self.prefix+'commands',options=mqtt.SubscribeOptions(qos=1,retainAsPublished=True,retainHandling=2))

    def on_subscribe(self,client,userdata,mid,reasons,properties=None):
        self.connected=all(getattr(r,"value",r)<128 for r in reasons)

    def ack(self,body,accepted,error=''):
        result=dict(protocol='MAR-SIM-1',robotId=self.robot_id,sessionId=self.session,
            correlationId=body.get('correlationId'),runId=body.get('runId'),accepted=accepted,error=error,sentAt=stamp())
        self.client.publish(self.prefix+'acks',json.dumps(result),qos=1,retain=False)
        return result

    def on_message(self,client,userdata,message):
        if message.retain or message.qos!=1 or len(message.payload)>65536:return
        body={}
        try:
            body=json.loads(message.payload)
            if body.get('protocol')!='MAR-SIM-1' or body.get('robotId')!=self.robot_id or body.get('sessionId')!=self.session:
                return
            cid=str(uuid.UUID(body['correlationId']))
            expiry=datetime.fromisoformat(body['expiresAt'].replace('Z','+00:00')).timestamp()
            requested=datetime.fromisoformat(body['requestedAt'].replace('Z','+00:00')).timestamp()
            if not time.time()<expiry<=time.time()+5 or abs(time.time()-requested)>5:
                raise ValueError('Command expired')
            digest=__import__('hashlib').sha256(message.payload).hexdigest()
            if cid in self.seen:
                old_hash,old=self.seen[cid]
                if old_hash==digest:self.client.publish(self.prefix+'acks',json.dumps(old),qos=1,retain=False)
                return
            kind=body.get('commandType')
            if kind=='LEASE':
                if body.get('runId') in (self.node.run_id,self.node.queued_run):self.node.last_ui=time.monotonic()
                return
            if kind in ('START_PATROL','NAVIGATE_TO'):
                body['validatedSteps']=validate_run(body,self.node.envelope,self.node.data)
                with self.node.lock:
                    if self.node.state['status'] in ('STARTING','RUNNING','CANCELING') or self.node.queued_run:
                        raise ValueError('An active run already exists')
                    self.node.queued_run=body['runId']
                try:self.node.commands.put_nowait(('/run',body))
                except Exception:
                    self.node.queued_run=None
                    raise
                self.node.last_ui=time.monotonic()
            elif kind=='CANCEL_PATROL':
                self.node.commands.put_nowait(('/cancel',body))
            else:raise ValueError('Unsupported simulation command')
            result=self.ack(body,True)
            self.seen[cid]=(digest,result)
            if len(self.seen)>2000:self.seen.pop(next(iter(self.seen)))
        except Exception as error:
            self.ack(body,False,str(error))

    def tick(self):
        if not self.connected or time.monotonic()<self.next_publish:return
        self.next_publish=time.monotonic()+.5
        self.sequence+=1
        value=self.node.snapshot()
        value.update(protocol='MAR-SIM-1',robotId=self.robot_id,sessionId=self.session,sequence=self.sequence,
            sentAt=stamp(),mapId=self.node.data['mapId'],mapVersion=self.node.data['mapVersion'],
            mqttConnected=True,rosConnected=time.monotonic()-self.node.clock_seen<2,
            simulationActive=time.monotonic()-self.node.clock_seen<2,sourceType='LOCAL_MOCK')
        self.client.publish(self.prefix+'telemetry',json.dumps(value,allow_nan=False),qos=0,retain=False)

    def close(self):
        self.client.disconnect()
        self.client.loop_stop()
