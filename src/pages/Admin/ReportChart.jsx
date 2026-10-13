// Native chart labels are localized, unlike the previous bitmap placeholders.
export default function ReportChart({title,items,unit=''}){
 const max=Math.max(1,...items.map(i=>Number(i.value)||0));
 return <figure className="analytics-reports__chart" style={{padding:20,color:'#e2e8f0'}}><figcaption style={{fontSize:15,fontWeight:600,marginBottom:20}}>{title}</figcaption><svg viewBox="0 0 540 240" role="img" aria-label={title} style={{width:'100%',display:'block'}}>
   {[0,1,2,3,4].map(i=><g key={i}><line x1="150" y1={20+i*45} x2="520" y2={20+i*45} stroke="#233d56"/></g>)}
   {items.map((item,i)=><g key={item.label} transform={'translate(0,'+(30+i*65)+')'}><text x="0" y="20" fill="#c5d8e8" fontSize="13">{item.label}</text><rect x="150" y="0" width={Math.max(0,Number(item.value)||0)/max*300} height="30" rx="5" fill={item.color||'#2f80ff'}/><text x={160+Math.max(0,Number(item.value)||0)/max*300} y="20" fill="white" fontSize="13">{item.value!=null&&Number.isFinite(Number(item.value))?Number(item.value).toLocaleString('vi-VN')+unit:'—'}</text></g>)}
 </svg><small style={{color:'#94a3b8'}}>Dữ liệu tổng hợp từ báo cáo API; dấu — nghĩa là chưa có dữ liệu.</small></figure>;
}
