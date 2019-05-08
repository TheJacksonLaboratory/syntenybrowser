# importing as 'application' means that in addition to running this as a main
# python script, we can use this file as a WSGI application entry point
from application import app


def main():
    app.run(debug=True, host="0.0.0.0", port=5001)


if __name__ == '__main__':
    main()
