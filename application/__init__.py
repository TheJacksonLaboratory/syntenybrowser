from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

CORS(app)

from synbrowser import jsonAPI
from synbrowser import views

