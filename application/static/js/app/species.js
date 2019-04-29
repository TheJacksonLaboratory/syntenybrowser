"use strict";

/**
 * @file: species.js
 * @fileOverview: contains methods to read config file data and to set species properties 
 * and getter methods to these properties 
 * and importing data into the application
 * @created: 02/13/2018
 * @last modified: 02/20/2018
 * @author: georgi.kolishovski@jax.org, anna.lamoureux@jax.org
 */

let Species;

(function(Species) {

    /**
     * Generic Species Class
     */
    Species.Species = (function() {
        /**
         * @param {string} configFileName - config file name
         * @constructor
         */
        function Species(configFileName) {

            // PRIVATE VARIABLES
            // variable values are retrieved from the config file
            
            // species NCBI id: i.e. 10090
            let id = null;
            // species name: i.e. Mus musculus
            let name = null;
            // config file name
            let source = configFileName;
            // array: species chromosomes and their sizes
            let chrSizes = null;
            // categories of available species search data types: i.e. QTL, gene, etc.
            let dataCategories = null;
            // list of links to exteral information resources for that species
            let externalResources = null;
            // loaded ontologies (for this species)
            let ontologies = [];

            /**
             * config file parser function: parses the config file and loads its data
             */
            function parseConfigFile() {
                // use this url variable for Synteny page
                let url = "static/js/data/" + source;

                // use this url variable for testing purposes
                // let url = "../js/data/" + source;

                // set AJAX to synchronous execution mode (till the config data loading completes)
                $.ajaxSetup({"async": false});

                $.getJSON(url).done(function(data) {
                    let organism = data.organism;

                    id = organism.taxon_id;
                    chrSizes = organism.chromosomes;
                    name = organism.name;
                    dataCategories = organism.search_categories;
                    externalResources = organism.external_resources;

                    let onts = [];

                    dataCategories.forEach(function(cat) {
                        if(cat.search_type === "OntAnnotation") {
                            onts.push({ abbrev: cat.name, name: cat.value });
                        }
                    });

                    // sorts ontologys alphabetically
                    onts.sort(function(a, b) {
                        return a.abbrev.localeCompare(b.abbrev);
                    });

                    ontologies = onts;
                });

                // set AJAX back to (its default) asynchronous execution mode
                $.ajaxSetup({"async": true});
            };

            parseConfigFile();

            // PRIVILEGED GETTER METHODS
            /**
             * returns chromosome size data for the species
             *
             * @return {Array} - chromosome sizes
             */
            this.getChromosomeSizes = function() {
                return chrSizes;
            };

            this.__defineGetter__("dataCategories", function() {
                return dataCategories;
            });

            this.__defineGetter__("externalResources", function() {
                return externalResources;
            });

            /**
             * returns the taxon id for the species
             *
             * @return {number} - taxon id
             */
            this.getSpeciesId = function() {
                return id;
            };

            this.__defineGetter__("name", function() {
                return name;
            });

            this.__defineGetter__("ontologies", function() {
                return ontologies;
            });

            this.__defineGetter__("source", function() {
                return source;
            });
        }

        return Species;
    })();

})(Species || (Species={}));