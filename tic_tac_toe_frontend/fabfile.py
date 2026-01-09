from fabric import task, Connection
from invoke import Responder
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ========== CONFIG ==========
HOST = "kavia@121.244.192.84"        
REMOTE_PATH = "~/qemu" # Or the path where your files are located on the server
# ============================

# 1. Respond to login
auto_login = Responder(
    pattern=r"login:",
    response="root\n",
)

# 2. Execute command sequence and power off
# Detects the prompt "root@vdevicex86-64:~#" and sends the command string.
# The ';' tells Linux: "run this, then this, then this..."
run_commands = Responder(
    pattern=r"root@vdevicex86-64:~#",
    response="ls; cd /usr/bin/; ls; poweroff\n",
)

@task
def build(c):
    print("🔎 Validating connection...")
    print("🔎 Validating environment variables...")
    ssh_pass = os.environ.get("REACT_APP_SSH_PASSWORD", "").strip()
    
    if ssh_pass:
        print(f"✅ REACT_APP_SSH_PASSWORD found (Length: {len(ssh_pass)} characters)")
    else:
        print("❌ ERROR: REACT_APP_SSH_PASSWORD variable does not exist or is empty.")
        # Optional: print all keys to see what is available
        print("Available variables:", list(os.environ.keys()))

    conn = Connection(
        HOST,
        connect_kwargs={
            "password": ssh_pass,
        }
    )
    print("✔️ Connection established")

    try:
        print(f"\n🚀 Launching QEMU in {REMOTE_PATH}...")
         
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
        
        # Add both watchers to the list
        conn.run(
            f"cd {REMOTE_PATH} && {qemu_cmd}", 
            pty=True, 
            watchers=[auto_login, run_commands] 
        )

    finally:
        # When 'poweroff' runs inside the VM, QEMU closes automatically 
        # and the script reaches this point naturally.
        conn.close()
        print("🔌 SSH connection closed safely")