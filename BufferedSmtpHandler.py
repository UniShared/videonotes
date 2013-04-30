__author__ = 'arnaud'

#!/usr/bin/env python
#
# Copyright 2001-2002 by Vinay Sajip. All Rights Reserved.
#
# Permission to use, copy, modify, and distribute this software and its
# documentation for any purpose and without fee is hereby granted,
# provided that the above copyright notice appear in all copies and that
# both that copyright notice and this permission notice appear in
# supporting documentation, and that the name of Vinay Sajip
# not be used in advertising or publicity pertaining to distribution
# of the software without specific, written prior permission.
# VINAY SAJIP DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE, INCLUDING
# ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL
# VINAY SAJIP BE LIABLE FOR ANY SPECIAL, INDIRECT OR CONSEQUENTIAL DAMAGES OR
# ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER
# IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT
# OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
#
# This file is part of the Python logging distribution. See
# http://www.red-dove.com/python_logging.html
#
"""Test harness for the logging module. Tests BufferingSMTPHandler, an alternative implementation
of SMTPHandler.

Copyright (C) 2001-2002 Vinay Sajip. All Rights Reserved.
"""
from google.appengine.api import mail
import logging, logging.handlers

class BufferingSMTPHandler(logging.handlers.BufferingHandler):
    FROM     = 'arnaud@unishared.com'
    TO       = 'arnaud@unishared.com'

    def __init__(self, capacity):
        logging.handlers.BufferingHandler.__init__(self, capacity)
        self.fromaddr = BufferingSMTPHandler.FROM
        self.toaddrs = BufferingSMTPHandler.TO
        self.setFormatter(logging.Formatter("%(asctime)s %(levelname)-5s %(message)s"))

    def flush(self):
        if len(self.buffer) > 0:
            try:
                msg = ""
                for record in self.buffer:
                    s = self.format(record)
                    print s
                    msg = msg + s + "\r\n"
                mail.send_mail(self.fromaddr,self.toaddrs, "Error in VideoNot.es", msg)
            except Exception, e:
                self.handleError(None)  # no particular record
            self.buffer = []