"""
A routine that detects whether a file is gzipped (by looking at the file name)
or not, and does the correct open, returning a "file like" object.
"""

import gzip
import io

def flex_open(fn, mode=None):
    if fn.endswith('.gz'):
        # gzipped file.
        if mode is None:
            mode = 'rt'
        return gzip.open(fn, mode)
    else:
        # Assume regular file.
        if mode is None:
            mode = 'rU'
        return open(fn, mode)