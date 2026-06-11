import sys
from pathlib import Path
import olefile
import re

def extract_doc_text(path):
    p = Path(path)
    if not olefile.isOleFile(p):
        return f"NOT OLE: {p}"
    ole = olefile.OleFileIO(p)
    text_parts = []
    try:
        # Walk through streams looking for WordDocument content
        word_doc = ole.openstream('WordDocument').read()
        # Table stream contains formatting; for plain text try a simpler approach
        # Many Russian .doc files store text in 1Table or Table streams
        # We'll just dump readable unicode strings from WordDocument
        for stream_name in ole.listdir():
            full = '/'.join(stream_name)
            try:
                data = ole.openstream(stream_name).read()
                # extract printable UTF-16LE chunks
                if len(data) > 0:
                    try:
                        decoded = data.decode('utf-16-le', errors='ignore')
                        # keep only printable
                        cleaned = ''.join(c for c in decoded if c.isprintable() or c in '\r\n\t')
                        cleaned = re.sub(r'\s+', ' ', cleaned)
                        if cleaned.strip():
                            text_parts.append(f"--- {full} ---\n{cleaned}\n")
                    except Exception:
                        pass
            except Exception as e:
                text_parts.append(f"!! {full}: {e}\n")
    finally:
        ole.close()
    return '\n'.join(text_parts)

if __name__ == "__main__":
    for path in sys.argv[1:]:
        print(extract_doc_text(path))
        print("=" * 80)
