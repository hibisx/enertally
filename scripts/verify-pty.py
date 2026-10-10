"""Local PTY smoke acceptance; not a graphical terminal or physical-device test."""
import os, pty, subprocess, termios, fcntl, struct, select, time, signal, json, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def run(cols, rows, terminate=False):
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))
    before = termios.tcgetattr(slave)
    proc = subprocess.Popen(['bun', str(ROOT / 'apps/cli/dist/index.js'), 'tui'], stdin=slave, stdout=slave, stderr=slave, cwd=ROOT)
    output = bytearray()
    def drain(seconds=.35):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            if select.select([master], [], [], .03)[0]:
                output.extend(os.read(master, 65536))
    def send(data):
        os.write(master, data.encode()); drain()
    try:
        drain(.8)
        if terminate:
            proc.send_signal(signal.SIGTERM)
        else:
            send('/demo\r'); send('/compare\r')
            # Focus and modify a field with native editing keys.
            send('/edit scenario\r'); send('\x01'); send('\x1b[3~' * 5); send('20000')
            send('\x0b'); send('/compare\r')  # Ctrl+K command menu
            with tempfile.TemporaryDirectory(prefix='enertally-pty-', dir='/private/tmp') as directory:
                target = str(Path(directory) / 'result.json')
                send('\x0b'); send('/export\r'); send(target + '\r')
                result = json.loads(Path(target).read_text())
                assert result['scenarioCostUSD'] == 260000, result
                original = Path(target).read_bytes()
                send('\x0b'); send('/export\r'); send(target + '\r\r')
                assert Path(target).read_bytes() == original, 'existing export changed'
                send('\x1b')
                send('\x0b'); send('/import\r'); send('DISCARD\r'); send(directory + '/missing.json\r')
                send('\x1b')
                send('\x0b'); send('/import\r'); send('DISCARD\r'); send(target + '\r')
                send('\x0b'); send('/compare\r')
                second = str(Path(directory) / 'second.json')
                send('\x0b'); send('/export\r'); send(second + '\r')
                restored = json.loads(Path(second).read_text())
                assert restored['scenarioCostUSD'] == 260000 and restored['dataSource'] == 'user-provided'
                # Resize while live, then open/close menu; draft stays intact.
                fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 36, 120, 0, 0)); proc.send_signal(signal.SIGWINCH); drain()
                send('\x0b'); send('\x1b'); send('\x0b'); send('/quit\r')
        drain(.3); proc.wait(timeout=5)
        assert proc.returncode == (1 if terminate else 0), proc.returncode
        after = termios.tcgetattr(slave)
        assert (before[3] & (termios.ECHO | termios.ICANON)) == (after[3] & (termios.ECHO | termios.ICANON)), 'terminal mode not restored'
        assert b'\x1b[?1049l' in output and b'\x1b[?25h' in output, 'missing alternate-screen/cursor cleanup'
        print(f'PASS {cols}x{rows}: ' + ('SIGTERM cleanup' if terminate else 'demo/edit/menu/compare/import/export/no-overwrite/resize/quit and termios restoration'))
    finally:
        Path("/private/tmp/enertally-pty-last.log").write_bytes(output)
        if proc.poll() is None: proc.kill(); proc.wait()
        os.close(master); os.close(slave)
run(80,24)
run(120,36)
run(50,16,True)
