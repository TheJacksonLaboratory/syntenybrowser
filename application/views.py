import json
import flask
import os
from synbrowser import app
from synbrowser import sqliteaccess as dba


@app.route('/about.html')
def about():
    return flask.render_template('about.html')


@app.route('/docs.html')
def docs():
    return flask.render_template('docs.html')


@app.route('/')
@app.route('/index.html')
def index():
    """
    Parses the user provided config files and extracts the reference
    and comparison species taxon_id and name into an object list.

    :return:  the rendered with the given context Flask template
    """
    species = []

    script_dir = os.path.dirname(os.path.realpath(__file__))
    config_files_dir = os.path.join(script_dir, 'static', 'js', 'data')

    for root, dirs, files in os.walk(config_files_dir):
        for file_ in files:
            with open(os.path.join(root, file_)) as data_file:
                data_loaded = json.load(data_file)
                if 'order' in data_loaded:
                    # [gik]:TODO: below logic is very simplified: more complicated scenarios should be handled in future
                    pos = data_loaded['order'] - 1
                else:
                    # if no order specified, insert last
                    pos = len(species)

                species.insert(pos, {
                    'id': data_loaded['organism']['taxon_id'],
                    'name': data_loaded['organism']['name'],
                })

    return flask.render_template('index.html', species = species[:2])


@app.route('/license.html')
def license():
    return flask.render_template('license.html')