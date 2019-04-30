## Introduction
An interactive web-based conserved synteny browser application, The Jackson Laboratory (JAX) Synteny Browser. The browser 
allows researchers to highlight or selectively display genome features in the reference and/or the comparison genomes 
based on the biological attributes of the features. The current implementation for the browser supports the reference 
genomes of the laboratory mouse and human.

There is a live, working version of Synteny Browser available at: [syntenybrowser.jax.org](http://syntenybrowser.jax.org/) 

User documentation can be found [here](http://syntenybrowser.jax.org/static/docs/SB-UserManual-050219-1006-50.pdf).

## Setting up/Running Synteny Browser Locally
Before starting the setup process, there are a couple prerequisites:

1. A bash terminal (Mac OS X & Linux will have this included)
2. A version of Python installed on your machine
3. Pip installed on your machine (your version of Python might have Pip included by default, but if not, you'll have to 
install it manually)

Assuming you have both of the above items, we first need to set up a virtual environment to run all of the application 
related services. To do this, open up a bash terminal and navigate to the `syntenybrowser/` directory (all of the 
following commands are run from this directory unless otherwise noted) and run

    pip install virtualenv
    
Note: if you're running Python 3, you will probably have to run `pip3 install virtualenv`. Once the install is finished, 
let's create our virtual environment with

    virtualenv venv -p python2.7
    
Once the virtual environment process is finished, activate it using

    . venv/bin/activate
    
And and install the necessary packages to run the services with
    
    pip install -r application/requirements.txt
    
At this point, your virtual environment is set up and we can move onto the next step: creating the database that will be 
used by the web application which should require running the following *update with real instructions here*

    db-creation/load_master.sh synteny
    
This will take several minutes. Once done *we need to know where the database is generated so that we can access it* 
you're ready to run the application which can be done with 

    python application/runserver.py
    
Once the server indicates the address the page is being served to and prints the debugger pin code, visit the specified 
address in your browser, which should be `http://localhost:5000`. Once you're done running the app, you can shut down the 
virtual environment using

    deactivate

## Citation
**The JAX Synteny Browser for Mouse-Human Comparative Genomics.**

Bioinformatics; pending approval

## License
The JAX Synteny Browser is provided under the license found [here](LICENSE.md).
