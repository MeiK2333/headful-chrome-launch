import logging
import os

logger = logging.getLogger("headful-crawler")

logger.setLevel(logging.DEBUG)
ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG if os.environ.get("debug") else logging.INFO)
formatter = logging.Formatter("%(asctime)s [%(levelname)s]: %(message)s")

ch.setFormatter(formatter)
logger.addHandler(ch)
