from fabric import task, Connection
import datetime
import os
import subprocess
import zipfile
import sys

# ============================================================
# CONFIGURATION
# ============================================================

HOST = "ubuntu@54.189.2.248"              # Target build VM
REMOTE_PATH = "/home/ubuntu/tic-tac-toe-classic-301935-301944/tic_tac_toe_frontend"    # Repo path on VM

LOCAL_BASE_PATH = os.path.expanduser("~/VM")
LOCAL_LOG_PATH = f"{LOCAL_BASE_PATH}/logs"
LOCAL_OUTPUT_PATH = f"{LOCAL_BASE_PATH}/output"

# SSH CA private key (must be mounted in Kavia session)
CA_KEY = os.path.expanduser("~/.ssh/ca/ssh_ca")

# Ephemeral SSH key (lives only during this session)
KEY_PATH = "/tmp/kavia_build_key"

SSH_CERT_TTL = "+5m"

# ============================================================
# PREP
# ============================================================

os.makedirs(LOCAL_LOG_PATH, exist_ok=True)
os.makedirs(LOCAL_OUTPUT_PATH, exist_ok=True)


def fatal(msg: str):
    print(f"\n❌ FATAL: {msg}")
    sys.exit(1)


def run_checked(cmd: list[str], description: str):
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError:
        fatal(f"Failed during: {description}")


def validate_environment():
    print("🔎 Validating environment...")

    if not os.path.exists(CA_KEY):
        fatal("SSH CA private key not found")

    for binary in ["ssh-keygen"]:
        if subprocess.run(["which", binary], capture_output=True).returncode != 0:
            fatal(f"Required binary missing: {binary}")

    print("✔️ Environment validated")


# ============================================================
# SSH CERT MANAGEMENT
# ============================================================

def generate_ssh_cert():
    print("🔐 Generating ephemeral SSH key...")

    run_checked(
        ["ssh-keygen", "-f", KEY_PATH, "-N", "", "-t", "rsa", "-q"],
        "SSH key generation"
    )

    os.chmod(KEY_PATH, 0o600)

    print("🔏 Signing SSH key with CA...")

    run_checked(
        [
            "ssh-keygen",
            "-s", CA_KEY,
            "-I", "kavia-build-session",
            "-n", "ubuntu",
            "-V", SSH_CERT_TTL,
            f"{KEY_PATH}.pub"
        ],
        "SSH certificate signing"
    )

    print("✔️ Ephemeral SSH certificate ready")


def cleanup_keys():
    for suffix in ["", ".pub", "-cert.pub"]:
        try:
            os.remove(f"{KEY_PATH}{suffix}")
        except FileNotFoundError:
            pass


# ============================================================
# BUILD TASK
# ============================================================

@task
def build(c):
    validate_environment()

    try:
        generate_ssh_cert()

        print("🔌 Connecting to build VM...")
        conn = Connection(
            HOST,
            connect_kwargs={"key_filename": KEY_PATH},
        )

        timestamp = datetime.datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")

        local_log_file = f"{LOCAL_LOG_PATH}/build_{timestamp}.log"
        local_zip_file = f"{LOCAL_OUTPUT_PATH}/build_{timestamp}.zip"
        extract_path = f"{LOCAL_OUTPUT_PATH}/build_{timestamp}"

        print("📥 Pulling latest code...")
        conn.run(f"cd {REMOTE_PATH} && git pull")

        print("🔨 Running build on remote VM...")
        result = conn.run(
            f"cd {REMOTE_PATH} && npm run build > build.log 2>&1",
            warn=True
        )

        # ------------------------------------------------------------
        # BUILD FAILED
        # ------------------------------------------------------------
        if result.exited != 0:
            print("❌ Build failed. Retrieving logs...")

            conn.get(f"{REMOTE_PATH}/build.log", local_log_file)

            print("\n----- 🔥 BUILD LOG START -----\n")
            with open(local_log_file) as f:
                print(f.read())
            print("\n----- 🔥 BUILD LOG END -----\n")

            return

        # ------------------------------------------------------------
        # BUILD SUCCESS
        # ------------------------------------------------------------
        print("✅ Build succeeded. Packaging artifacts...")

        conn.run(f"cd {REMOTE_PATH} && zip -r build.zip build")

        conn.get(f"{REMOTE_PATH}/build.zip", local_zip_file)

        os.makedirs(extract_path, exist_ok=True)

        with zipfile.ZipFile(local_zip_file) as zip_ref:
            zip_ref.extractall(extract_path)

        os.remove(local_zip_file)

        print("🎉 Build completed successfully")
        print(f"📦 Artifacts available at: {extract_path}")

    finally:
        cleanup_keys()
        print("🧹 Ephemeral SSH material cleaned up")