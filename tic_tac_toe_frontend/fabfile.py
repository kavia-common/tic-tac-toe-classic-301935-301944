from fabric import task, Connection
from invoke import Responder # Importamos Responder para interactuar con la consola
import os

# ========== CONFIG ==========
# Asegúrate de que este HOST sea correcto (en tu imagen usabas kavia@SKY...)
HOST = "kavia@121.244.192.84"      
REMOTE_PATH = "~/qemu"         # Actualizado a la ruta vista en tus capturas

# Definimos el "Vigilante" (Responder)
# Cuando el script vea "login:", responderá "root" automáticamente.
auto_login = Responder(
    pattern=r"login:",   # Expresión regular o texto a buscar
    response="root\n",   # Lo que escribirá (el \n es el Enter)
)

# Opcional: Si quieres que el script apague la máquina después de loguearse 
# para que el script de python termine, descomenta las siguientes líneas:
# auto_poweroff = Responder(
#    pattern=r"root@vdevice.*:~#", # Detecta el prompt de root
#    response="poweroff\n",        # Manda apagar
# )
# ============================

@task
def build(c):
    print("🔎 Validating connection...")
    conn = Connection(
        HOST,
        connect_kwargs={
            "password": os.environ.get("SSH_PASSWORD"),
        }
    )
    print("✔️ Connection established")

    try:
        print(f"\n🚀 Launching QEMU in {REMOTE_PATH}...")
        
        # El comando largo de QEMU (versión sin gráficos para terminal)
        qemu_cmd = (
            "qemu-system-x86_64 -kernel bzImage "
            "-append \"console=ttyS0 root=/dev/sda video=1280x720\" "
            "-drive if=none,id=hd,file=core-image-vdevice-xfce-vdevice_x86-64-20251104054519.rootfs.ext4,format=raw "
            "-device virtio-scsi-pci,id=scsi "
            "-device scsi-hd,drive=hd "
            "-smp 8 -m 4096 "
            "-nographic "   # Importante: modo texto
            "-vga none "
            "-device usb-tablet "
            "-netdev user,id=network0 -device virtio-net,netdev=network0 "
            "-usb -device usb-host,vendorid=0x0bb4,productid=0x0a5f "
            "-audiodev id=snd0,driver=none "
            "-device ich9-intel-hda -device hda-duplex,audiodev=snd0 "
            "-nic user,ipv6=off,model=e1000,id=network_0,net=10.0.8.0/24,hostfwd=tcp:127.0.0.1:5522-:22"
        )

        print("👀 Watching for login prompt to type 'root'...")
        
        # Ejecutamos el comando pasando el 'watcher'
        # pty=True es importante para que QEMU crea que está en una terminal real
        conn.run(
            f"cd {REMOTE_PATH} && {qemu_cmd}", 
            pty=True, 
            watchers=[auto_login] 
        )

        # NOTA: Como QEMU se queda corriendo, este script de Python
        # se quedará "colgado" aquí mostrando la salida de la consola de la VM.
        # Para salir manualmente, normalmente usarías 'Ctrl+A' soltar y luego 'x'.
        
    finally:
        conn.close()
        print("🔌 Connection closed")