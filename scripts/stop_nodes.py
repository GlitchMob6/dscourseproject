"""
stop_nodes.py - Safe MongoDB Process Shutdown Utility
Connects to specified ports and issues administrative shutdown commands.
Prevents database corruption by avoiding abrupt task killing.
"""

import sys
import time
import pymongo
from pymongo import MongoClient

def stop_nodes(ports):
    print(f"[*] Initiating graceful shutdown for MongoDB nodes on ports: {ports}")
    for port in ports:
        try:
            client = MongoClient(
                f"mongodb://127.0.0.1:{port}/?directConnection=true",
                serverSelectionTimeoutMS=1500
            )
            try:
                client.admin.command('shutdown')
                print(f" [+] [Port {port}] Shutdown signal acknowledged.")
            except Exception as e:
                err_str = str(e).lower()
                if any(w in err_str for w in ["connection", "closed", "autoreconnect", "10054"]):
                    print(f" [+] [Port {port}] Node terminated and closed socket cleanly.")
                else:
                    print(f" [!] [Port {port}] Shutdown notice: {e}")
            client.close()
        except pymongo.errors.ServerSelectionTimeoutError:
            print(f" [-] [Port {port}] Node is already offline.")
        except Exception as e:
            print(f" [!] [Port {port}] Error connecting: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_ports = [int(p) for p in sys.argv[1:]]
    else:
        target_ports = [27018, 27019, 27020]
    stop_nodes(target_ports)
