from base64 import a85decode
import re
import zlib


def pdf_text(content):
    """Read the text operators in the actual ReportLab page streams."""
    streams = re.findall(rb'stream\r?\n(.*?)\r?\n?endstream', content, flags=re.S)
    return b'\n'.join(zlib.decompress(a85decode(stream, adobe=True)) for stream in streams)
