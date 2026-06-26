#!/usr/bin/env python3
"""Servidor de desarrollo robusto para Chicken Rush.

El `python -m http.server` por defecto se cae con BrokenPipeError /
ConnectionResetError cuando el navegador corta una petición (recargas,
cierres de pestaña, etc.). Este servidor:
  - usa hilos (ThreadingHTTPServer) para no bloquearse,
  - ignora los errores de conexión cortada en vez de morir,
  - se reinicia solo si algo inesperado tumba el bucle principal,
  - reutiliza el puerto al reiniciar,
  - registra cualquier error en serve.log para poder diagnosticar,
  - sirve siempre la carpeta del propio script.
"""
import http.server
import socketserver
import os
import sys
import time
import traceback

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

# Servir siempre desde la carpeta donde está este script.
BASE = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE)
LOG = os.path.join(BASE, "serve.log")


def log(msg):
    """Escribe en serve.log con marca de tiempo y vuelca a stdout sin buffer."""
    line = time.strftime("[%Y-%m-%d %H:%M:%S] ") + str(msg)
    try:
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass
    print(line, flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    # Silenciar el log normal de peticiones (ruido).
    def log_message(self, *args):
        pass

    # Tragarse los cortes de conexión típicos del navegador.
    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            self.close_connection = True

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True       # los hilos no impiden cerrar el proceso
    allow_reuse_address = True  # poder reiniciar sin "address already in use"

    # Que un error en un hilo no tumbe el servidor entero; solo lo registramos.
    def handle_error(self, request, client_address):
        log("Error atendiendo a %s:\n%s" % (client_address, traceback.format_exc()))


def main():
    # Bucle de auto-recuperación: si serve_forever revienta por algo inesperado,
    # lo registramos y reintentamos en vez de morir del todo.
    while True:
        try:
            with Server(("", PORT), Handler) as httpd:
                log("Sirviendo Chicken Rush en http://localhost:%d/" % PORT)
                httpd.serve_forever()
        except KeyboardInterrupt:
            log("Parado a mano (Ctrl+C).")
            return
        except OSError as e:
            # Puerto ocupado u otro error de socket: esperar y reintentar.
            log("Error de socket (%s). Reintentando en 1s..." % e)
            time.sleep(1)
        except Exception:
            log("Caída inesperada del servidor:\n" + traceback.format_exc())
            time.sleep(1)


if __name__ == "__main__":
    main()
