from fabric import task, Connection
from invoke import Responder
import os

# ========== CONFIG ==========
# Usa la IP real de tu máquina remota
HOST = "kavia@121.244.192.84"        
REMOTE_PATH = "~/qemu" # O la ruta donde tengas los archivos en el servidor
# ============================

# 1. Responde al login
auto_login = Responder(
    pattern=r"login:",
    response="root\n",
)

# 2. Ejecuta la secuencia de comandos y apaga
# Detecta el prompt "root@vdevicex86-64:~#" y envía la cadena de comandos.
# El ';' le dice a Linux: "ejecuta esto, luego esto, luego esto..."
run_commands = Responder(
    pattern=r"root@vdevicex86-64:~#",
    response="ls; cd /usr/bin/; ls; poweroff\n",
)

@task
def build(c):
    print("🔎 Validating connection...")
    conn = Connection(
        HOST,
        connect_kwargs={
            # "password": "B0x7788@Acces$@!",
            "password": os.environ.get("REACT_APP_SSH_PASSWORD"),
        }
    )
    print("✔️ Connection established")

    try:
        print(f"\n🚀 Launching QEMU in {REMOTE_PATH}...")
        
        # Comando QEMU (Asegúrate de que el puerto 5522 o 5523 esté libre como vimos antes)
        qemu_cmd = (
            "qemu-system-x86_64 -kernel bzImage "
            "-append \"console=ttyS0 root=/dev/sda video=1280x720\" "
            "-drive if=none,id=hd,file=core-image-vdevice-xfce-vdevice_x86-64-20251104054519.rootfs.ext4,format=raw "
            "-device virtio-scsi-pci,id=scsi "
            "-device scsi-hd,drive=hd "
            "-smp 8 -m 4096 "
            "-nographic "
            "-vga none "
            "-device usb-tablet "
            "-netdev user,id=network0 -device virtio-net,netdev=network0 "
            "-usb -device usb-host,vendorid=0x0bb4,productid=0x0a5f "
            "-audiodev id=snd0,driver=none "
            "-device ich9-intel-hda -device hda-duplex,audiodev=snd0 "
            "-nic user,ipv6=off,model=e1000,id=network_0,net=10.0.8.0/24,hostfwd=tcp:127.0.0.1:5522-:22"
        )

        print("👀 Waiting for emulator interactions...")
        
        # Agregamos ambos watchers a la lista
        conn.run(
            f"cd {REMOTE_PATH} && {qemu_cmd}", 
            pty=True, 
            watchers=[auto_login, run_commands] 
        )

    finally:
        # Al ejecutarse 'poweroff' dentro de la VM, QEMU se cierra solo 
        # y el script llega a este punto naturalmente.
        conn.close()
        print("🔌 SSH connection closed safely")
"""
qemu-system-x86_64 -kernel bzImage \
-append "console=ttyS0 root=/dev/sda video=1280x720" \
-drive if=none,id=hd,file=core-image-vdevice-xfce-vdevice_x86-64-20251104054519.rootfs.ext4,format=raw \
-device virtio-scsi-pci,id=scsi \
-device scsi-hd,drive=hd \
-smp 8 -m 4096 \
-nographic \
-vga none \
-device usb-tablet \
-netdev user,id=network0 -device virtio-net,netdev=network0 \
-usb -device usb-host,vendorid=0x0bb4,productid=0x0a5f \
-audiodev id=snd0,driver=none \
-device ich9-intel-hda -device hda-duplex,audiodev=snd0 \
-nic user,ipv6=off,model=e1000,id=network_0,net=10.0.8.0/24,hostfwd=tcp:127.0.0.1:5522-:22
"""