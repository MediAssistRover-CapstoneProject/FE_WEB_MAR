# Chạy bản đồ bệnh viện với Gazebo và FE

## Chạy bằng Docker trên Windows (khuyến nghị)

Không cần mở máy ảo Ubuntu VMware. Docker Desktop cần chế độ Linux containers/WSL 2. ROS 2 Jazzy, Gazebo Harmonic và RViz2 nằm trong image Docker của thư mục này.

1. Trong FE, vào **Bản đồ → Quét** hoặc **Tuần tra → Gazebo**, bấm **Tải bản đồ cho Gazebo**. Chép file `hospital.gazebo.json` vào `gazebo/input/hospital.gazebo.json`. Sau khi sửa bản đồ hoặc điểm đích, xuất file mới và khởi động lại container.
2. Trong PowerShell tại thư mục gốc FE, chạy:

```powershell
docker compose -f gazebo/compose.yaml up --build -d
docker compose -f gazebo/compose.yaml logs -f simulator
```

3. Lấy dòng `Ma ket noi: ...` trong log. Tại **Tuần tra → Gazebo**, dùng địa chỉ `http://localhost:8765` và mã đó. Mã thay đổi mỗi lần container khởi động; đây không phải access token BE.

Mặc định container mở desktop Gazebo và RViz2 để xem trực tiếp trong **Tuần tra → Gazebo → Gazebo và RViz2**. Trang cũng có thể mở riêng tại `http://localhost:6080/vnc.html`. Để chạy chế độ nhẹ không có cửa sổ, đặt `SIM_GUI=false` trước khi khởi động lại:

```powershell
$env:SIM_GUI='false'
docker compose -f gazebo/compose.yaml up -d --force-recreate
```

GUI dùng đồ họa CPU nên có thể chậm. Muốn bật lại desktop, đặt `$env:SIM_GUI='true'` và chạy lại `up -d --force-recreate`. Kiểm tra bằng `docker compose -f gazebo/compose.yaml ps`; dừng bằng `docker compose -f gazebo/compose.yaml down`.

Nếu FE dùng `http://127.0.0.1:5173`, đặt `$env:FE_ORIGIN='http://127.0.0.1:5173'` trước khi chạy Compose. Cầu nối chỉ chấp nhận đúng origin và mã kết nối. Port 8765 và 6080 chỉ mở trên máy Windows này.

Nếu Docker lỗi khi giải nén image và ổ C gần đầy, trong Docker Desktop mở **Settings → Resources → Advanced → Disk image location** rồi chuyển dữ liệu sang ổ còn đủ chỗ, ví dụ `D:\DockerData`. Dùng tính năng chuyển của Docker Desktop để giữ nguyên image, container và volume; không tự xóa file `docker_data.vhdx`. Sau khi Docker Engine hoạt động lại, chạy lệnh `up --build -d` ở trên.

Các mục bên dưới dành cho cách chạy Ubuntu VMware cũ, chỉ dùng khi bạn muốn tự vận hành ngoài Docker.

Bộ này dùng **Ubuntu 24.04 Desktop + ROS 2 Jazzy + Gazebo Harmonic + Nav2**. FE vẫn chạy trên Windows. Robot vật lý trong Gazebo là **TurtleBot3 Waffle** từ bộ mẫu Nav2; hình rover trên web chỉ là ký hiệu hiển thị. Đây chưa phải model ROSOrin của Hiwonder.

## 1. Cài Linux trước

Cách này chỉ áp dụng nếu bạn chủ động dùng máy ảo Ubuntu riêng thay cho Docker ở trên.

1. Tải **Ubuntu 24.04 Desktop amd64** ở [trang Ubuntu 24.04](https://releases.ubuntu.com/24.04/). Chọn bản Desktop 24.04, không chọn Server hoặc bản Ubuntu khác.
2. Tạo máy ảo trong VMware Workstation hoặc phần mềm máy ảo có hỗ trợ đồ họa 3D. Gợi ý cấu hình khởi đầu: 4 CPU, 8 GB RAM, ổ ảo 50 GB, nếu máy chủ đủ tài nguyên. Đây là cấu hình đề xuất để thử, không phải mức tối thiểu của hãng.
3. Gắn ISO Ubuntu, cài Ubuntu Desktop, mở được giao diện Desktop rồi mới cài ROS. Bật hỗ trợ đồ họa 3D nếu nền tảng máy ảo hỗ trợ; Gazebo cần OpenGL phù hợp. Nếu GUI lỗi đồ họa, dùng Ubuntu trên máy thật hoặc thử chế độ headless bên dưới; cảm biến GPU vẫn cần renderer hoạt động.
4. Đặt mạng máy ảo thành **Bridged** để Windows truy cập được IP Ubuntu. Nếu dùng NAT, cần cổng chuyển tiếp từ Windows đến Ubuntu:8765.

[Hướng dẫn Hiwonder gốc](https://wiki.hiwonder.com/projects/ROSOrin/en/jetson-orin-nano-version/docs/9_Gazebo_Simulation.html) sử dụng ảnh máy ảo và workspace của hãng. Nếu cần đúng robot ROSOrin, tải ảnh/package từ tài liệu của hãng và kiểm tra phiên bản ROS trước khi tích hợp. Không trộn các lệnh Jazzy trong hướng dẫn này vào máy ảo hãng dùng ROS phiên bản khác. Bộ hiện tại tái dựng mặt bằng bệnh viện của FE và điều hướng bằng model Nav2 có sẵn.

## 2. Cài ROS và Gazebo trong Ubuntu

Trong **terminal Ubuntu**, cài ROS 2 Jazzy Desktop theo [hướng dẫn chính thức](https://docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html), gồm UTF-8, Ubuntu Universe và `ros2-apt-source`. Sau khi đã thêm kho ROS theo tài liệu, chạy:

```bash
sudo apt update
sudo apt install ros-jazzy-desktop ros-jazzy-navigation2 ros-jazzy-nav2-bringup ros-jazzy-nav2-minimal-tb3-sim python3-pil python3-yaml
source /opt/ros/jazzy/setup.bash
ros2 pkg prefix nav2_minimal_tb3_sim
gz sim --versions
```

Các gói của bộ mẫu kéo theo ROS–Gazebo bridge cần thiết. Cặp phiên bản dùng ở đây theo [Nav2 Jazzy](https://ros-navigation.github.io/mkdocs.nav2.org/jazzy/getting_started/quickstart/quickstart/) và [Gazebo Harmonic](https://gazebosim.org/docs/harmonic/install_ubuntu/).

## 3. Lấy đúng bản đồ của FE

1. Trên Windows, chạy FE như thường lệ bằng `npm run dev`, mở `http://localhost:5173`.
2. Vào **Bản đồ → Quét**: mặt bằng bệnh viện cũ đã được dùng lại. Hoàn tất/lưu bản đồ, vùng và điểm đích đang dùng. Dữ liệu vẫn lưu ở trình duyệt.
3. Bấm **Tải bản đồ cho Gazebo**. File nhận được là `hospital.gazebo.json`. File chứa hình học và các điểm đã lưu, không chứa token đăng nhập BE.
4. Chép cả thư mục `FE_WEB_MAR/gazebo` vào Ubuntu, ví dụ `~/mar-gazebo`. Chép file vừa tải vào cùng thư mục đó. Có thể dùng shared folder hoặc kéo thả của phần mềm máy ảo.
5. Tạo world 3D và bản đồ Nav2:

```bash
cd ~/mar-gazebo
python3 prepare_map.py hospital.gazebo.json --output generated
```

Kết quả: `hospital.sdf`, `hospital.pgm`, `hospital.yaml`, `hospital.gazebo.json` trong `generated/`. Kích thước mặt bằng mẫu: **1200 × 680 px, 60 × 34 m, 0,05 m/px**. Đây là mặt bằng mô phỏng cũ, không phải bản quét PGM tạm 92 × 185 px trước đó.

## 4. Mở Gazebo và cầu nối

Terminal Ubuntu số 1:

```bash
cd ~/mar-gazebo
source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=77
export ROS_AUTOMATIC_DISCOVERY_RANGE=LOCALHOST
ros2 launch ./hospital.launch.py map_dir:="$PWD/generated"
```

Đợi Gazebo và RViz mở, bản đồ hiện ra, Nav2 khởi động. Robot xuất hiện ở tọa độ `(0, -0.5)` mét; AMCL được khởi tạo cùng vị trí. Nếu không cần cửa sổ Gazebo, thêm `headless:=True` vào lệnh launch. Chế độ này vẫn chạy vật lý và cảm biến.

Terminal Ubuntu số 2:

```bash
cd ~/mar-gazebo
source /opt/ros/jazzy/setup.bash
export ROS_DOMAIN_ID=77
export ROS_AUTOMATIC_DISCOVERY_RANGE=LOCALHOST
python3 bridge.py --map generated/hospital.gazebo.json --bind 0.0.0.0 --origin http://localhost:5173
```

Terminal in ra **Mã kết nối** ngẫu nhiên, đổi mỗi lần khởi động. Dùng mã này trong FE, không dùng access token BE. Dịch vụ này dành cho máy của bạn trên mạng nội bộ; không cần mở ra Internet.

Lấy IP Ubuntu:

```bash
hostname -I
```

Ví dụ Ubuntu có IP `192.168.1.50`, FE nhập `http://192.168.1.50:8765`. `localhost` trong trình duyệt Windows là Windows, không phải máy ảo Bridged. Nếu Ubuntu bật UFW, cho phép cổng TCP 8765 từ riêng IP máy Windows. Không cần tắt tường lửa toàn bộ.

## 5. Chạy từ Quy trình → Tuần tra

1. Tại **Thiết kế quy trình**, tạo tuyến tuần tra cục bộ, chọn các endpoint của bản đồ đã lưu cho các bước MOVE, rồi lưu. Quy trình tuần tra hiện có yêu cầu ít nhất 2 bước.
2. Vào **Vận hành → Tuần tra**, chọn quy trình vừa lưu.
3. Chọn **Gazebo** cạnh Bản đồ 2D/Mô phỏng 3D; nhập IP Ubuntu và mã kết nối, bấm **Kết nối Gazebo**.
4. Chỉ khi trạng thái sẵn sàng, bấm **Chạy quy trình trên Gazebo**.
5. FE gửi các điểm theo thứ tự MOVE. Nav2 lập đường, robot trong Gazebo di chuyển; FE nhận vị trí qua TF và đường từ ROS. Chỉ kết quả thành công của Nav2 mới tăng số điểm đã hoàn thành.
6. Bấm **Dừng hành trình Gazebo** để hủy mục tiêu Nav2. Rời màn hình, ẩn trang hoặc mất kết nối sẽ yêu cầu hủy; cầu nối tự hủy khi không nhận tín hiệu từ phiên sở hữu hành trình trong 4 giây. Chờ trạng thái hủy trước khi chạy lại.

Điểm xuất phát của mô phỏng trình duyệt không đặt lại robot trong Gazebo; Gazebo luôn chạy từ vị trí đang định vị. 2D/3D trình duyệt vẫn dùng để xem thử khi chưa có Ubuntu. Tốc độ thực tế còn phụ thuộc giới hạn controller Nav2; bridge giới hạn tối đa 0,6 m/s và áp dụng mức thấp nhất của các vùng tốc độ trên toàn tuyến để thử thận trọng.

## 6. Khi chưa chạy được

- **Chưa kết nối / không phản hồi:** kiểm tra bridge còn chạy, IP, mạng máy ảo và cổng 8765. Đừng thay URL BE để sửa kết nối Gazebo.
- **Sai mã kết nối hoặc origin:** lấy mã từ terminal hiện tại. FE dùng `http://127.0.0.1:5173` thì khởi động bridge với đúng `--origin http://127.0.0.1:5173`.
- **Bản đồ khác nhau:** sau khi thay vùng/điểm, tải lại JSON, chạy lại prepare rồi khởi động lại cả launch và bridge. Không sửa hash bằng tay.
- **Chờ /clock:** Gazebo chưa chạy hoặc đang Pause.
- **Chờ định vị:** kiểm tra RViz và TF `map → base_link`; có thể dùng 2D Pose Estimate nếu đã di chuyển robot thủ công. Không kéo robot trong Gazebo mà giữ định vị cũ.
- **Điểm quá gần tường/vùng cấm:** sửa vị trí endpoint ở FE, xuất lại bản đồ. Nav2 còn kiểm tra khả năng đi tới; endpoint hợp lệ chưa đảm bảo có đường đi.
- **Map ROS không khớp:** kiểm tra `map_dir` đúng và chỉ có một bộ mô phỏng chạy trong domain 77. Gói tải mới phải được dùng cho cả launch và bridge.
- **Đồ họa đen hoặc Gazebo thoát:** kiểm tra hỗ trợ OpenGL của máy ảo. `headless:=True` chỉ bỏ cửa sổ Gazebo, không sửa lỗi GPU của cảm biến.

## Phạm vi hiện tại

- SDF chứa tường/vật cản; vùng KEEP_OUT được đánh dấu cấm trong occupancy map, không dựng thêm tường giả trong thế giới vật lý.
- Bộ này thực thi chuỗi MOVE cục bộ. Chưa đưa workflow vào hàng đợi Job/MQTT của BE và không dùng robot thật.
- Dừng là yêu cầu hủy Nav2, không phải cơ chế dừng khẩn cấp phần cứng. Nếu cưỡng bức tắt tiến trình bridge, dùng Gazebo Pause/Stop hoặc tắt launch; watchdog không còn chạy khi tiến trình đã chết.
- Chưa xác nhận vận hành trên Ubuntu/Gazebo của bạn vì máy chưa cài. Kiểm tra tự động của FE/gói xuất không thay thế lần chạy thật với Gazebo.

## Kiểm tra bộ xuất không cần ROS

Từ thư mục gốc FE, chạy `node --test tests/gazebo.test.mjs`, sau đó `python3 -m unittest discover -s gazebo -p "test_*.py"`. Python cần Pillow. Các kiểm tra này không gửi lệnh tới robot.
