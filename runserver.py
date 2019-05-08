# importing as 'application' means that in addition to running this as a main
# python script, we can use this file as a WSGI application entry point
from synbrowser import app as application


def main():
    application.run(debug=True, host="0.0.0.0", port=5001) # This is for Mei's testing on the server.
    #application.run(debug=True)


if __name__ == '__main__':
    main()
