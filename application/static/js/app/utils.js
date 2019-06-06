"use strict";

/**
 * @file: utils.js
 * @fileOverview: 
 * @created: 10/04/2017
 * @last modified: 11/04/2017
 * @author: georgi.kolishovski@jax.org, anna.lamoureux@jax.org
 */

let SynUtils;

(function(SynUtils) {
    SynUtils.geneHeight = 5; // pixel height of gene rectangles
    SynUtils.hideElementCutoff = 5000000; // interval width at which over this exons and labels are hidden
    SynUtils.highlightColor = "#006b07"; // color for gene elements when hovering over them
    SynUtils.errorStatusColor = "rgb(201,48,44)"; // color of status indicator when an error occurs
    SynUtils.processingStatusColor = "rgb(252,177,5)"; // color of status indicator when working/rendering
    SynUtils.finishedStatusColor = "rgb(39,175,24)"; // color of status indicator when processing is complete
    SynUtils.focusMargin = 2000000; // when focusing on a feature, interval will be 2 * this + feature width

    /**
     * if the chr is preceded by "ref", returns just chr
     *
     * @param {string} chr - the chromosome to check
     * @return {string} chr - reformatted chromosome name
     */
    SynUtils.checkAndResetChr = function(chr) {
        if (chr.length > 2) {
            if(chr.substring(0,4) === "chr0") {
                return chr.slice(4);
            }
            return chr.slice(3);
        }

        return chr;
    };

    /**
     * -- Not intended for use with object arrays -- Checks that the content of two arrays is the same
     * @param array1
     * @param array2
     */
    SynUtils.checkArrayEquivalency = function(array1, array2) {
        if(array1.length !== array2.length) { return false; }

        if(array1.length > 0) {
            if(typeof array1[0] !== typeof array2[0]) { return false; }

            for(let i = 0; i < array1.length; i++) {
                if(array1[i] !== array2[i]) { return false; }
            }
        }

        return true;
    };

    /**
     * compares two QTL ranges and returns the overlapping QTL (QTL creating an overlap) and the
     * endpoints for the overlap
     *
     * @param {Object} range1 - a QTL range
     * @param {Object} range2 - a second QTL range
     * @return {Object} overlap - data for the overlapping area (if exists)
     * @return {Object} overlap.start - start position of overlap
     * @return {Object} overlap.end - end position of overlap
     */
    SynUtils.compareRanges = function(range1, range2) {
        let overlap = {};
        let first = (range1.start_pos <= range2.start_pos) ? range1 : range2;
        let second = (range1.start_pos <= range2.start_pos) ? range2 : range1;

        // determine if there's an overlap
        if(first.start_pos <= second.end_pos && second.start_pos <= first.end_pos) {
            overlap.start = second.start_pos;
            // get range of overlap
            if(first.end_pos >= second.end_pos) {
                overlap.end = second.end_pos;
            }
            else {
                overlap.end = first.end_pos;
            }

            return overlap;
        }

        return null;
    };

    /**
     * implements simple jitter algorithm to calculate gene position
     *
     * TODO: This function is very hard to test since numbers are often very lengthy decimals
     * @param {number} space - available space
     * @param {number} position - position in bp of element
     * @param {number} height - height of element
     * @return {number} - element Y-position from top of track in px
     */
    SynUtils.calculateJitter = function(space, position, height) {
        if(space === 0) {
            return 0;
        }

        // 1.12 gets us close enough to edges without any elements overflowing
        let range = space / 1.12;
        // 1.13 pushes all elements down slightly to accomodate for the labels
        let offset = (((position % 1000) / 1000) * range) - range / 1.13;

        return ((space - height) / 1.12 + offset);
    };

    /**
     * gets the width of the specified chromosome
     *
     * TODO: Impractical to test as it requires JaxSynteny to be initialized
     * @param {string} chr - the chromosome to find the width of
     * @return {number} - the number of bases in the chromosome
     * @return {null} - the chromosome to search for doesn't exist
     */
    SynUtils.getMaxBase = function(chr) {
        let listToCheck = JaxSynteny.speciesRef.getChromosomeSizes();

        for(let i = 0; i < listToCheck.length; i++) {
            if(listToCheck[i].chr === chr) {
                return listToCheck[i].size;
            }
        }

        return null
    };


    /**
     * searches an array of objects to find out if any of the objects has 
     * a property, which matches the searched value
     *
     * @param {Object[]} arrobjs - an array of objects  
     * @param {string} prop - object property name
     * @param {string} value - the value to search for
     * @return {number} - the first index of the element in the array; -1 if not found
     */
    SynUtils.indexOfObj = function(arrobjs, prop, value) {
        for(let i = 0; i < arrobjs.length; i++) {
            if(arrobjs[i][prop] === value) {
                return i;
            }
        }
        return -1;
    };


    /**
     * expands the block view panel to show its content
     */
    SynUtils.openBlockView = function() {
        // scroll down to panel
        $('html,body').animate({
            scrollTop: $("#blockView").offset().top
        });
    };

    /**
     * transforms data input string into interval object; only accepts positive numeric values
     *
     * @param {string} intervalString - string to parse into interval
     * @return {Object || boolean} interval - contains information for desired interval
     *                false if interval can't be properly parsed
     */
    SynUtils.parseReferenceInterval = function(intervalString) {
        if(!intervalString) {
            return false;
        }
        let match = intervalString.replace(/,/g, '')
                                  .match(/^\s*(Chr)?([a-z0-9]+)\s*:\s*([0-9]+)\s*-\s*([0-9]+)\s*$/i);
        if(match) {
            let interval = {
                chr: match[2].toUpperCase(),
                startPos: parseInt(match[3]),
                endPos: parseInt(match[4])
            };

            interval.size = interval.endPos - interval.startPos;
            return interval;
        } else {
            // return false if interval not correctly entered or is empty
            return false;
        }
    };

    /**
     * returns a color value that is the same as the hex, but at the specified opacity
     *
     * @param {string} hex - hex color value
     * @param {number} opacity - opacity decimal for the faded color
     * @return {string} - faded color value in rgba form
     */
    SynUtils.fadeColor = function(hex, opacity) {
        let color;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
            color = hex.substring(1).split("");
            if(color.length === 3){
                color = [color[0], color[0], color[1], color[1], color[2], color[2]];
            }
            color= "0x"+color.join("");
            return "rgba("+[(color>>16)&255, (color>>8)&255, color&255].join(",")+"," + opacity +")";
        }
        throw new Error("Bad Hex");
    };

    /**
     * returns object that contain chromosome sizes and keys to indices conversion objects and arrays
     *
     * @param {Array} chrIntervalObjArray - array of chromosome sizes
     * @return {Object} - object that contain chromosome size data and key to index conversions
     */
    SynUtils.makeIntervalPairs = function(chrIntervalObjArray) {
        let intervalPairs = [];

        for(let i = 0; i < chrIntervalObjArray.length; i++) {
            intervalPairs.push([chrIntervalObjArray[i].chr, chrIntervalObjArray[i]]);
        }

        return this.makeOrderedPairs(intervalPairs);
    };

    /**
     * makes an associated array that makes it easy to track element ordering via the keys member
     *
     * @param {Array} ordPairs - an array of pairs (that is, an array where each element is a list of
     *                           length two). The first element of each pair is a string key and the
     *                           second is a value which can be any type.
     * @return {Object} orderedPairs - object with associated array and keys
     */
    SynUtils.makeOrderedPairs = function(ordPairs) {
        let orderedPairs = {
            length: ordPairs.length,
            keys: [],
            assocArr: {},
            keyIndices: {}
        };

        let i;
        for(i = 0; i < ordPairs.length; i++) {
            let currPair = ordPairs[i];
            let currKey = currPair[0];
            let currVal = currPair[1];

            orderedPairs.keys.push(currKey);
            orderedPairs.keyIndices[currKey] = i;
            orderedPairs.assocArr[currKey] = currVal;
        }

        orderedPairs.valueAt = function(index) {
            return orderedPairs.assocArr[orderedPairs.keys[index]];
        };

        return orderedPairs;
    };

    /**
     * creates an object that contains data and functions needed to render circos plot elements
     *
     * @param {Array} intervals - object array of interval pairs
     * @param {function} intervals.valueAt - function that returns object at a given index
     * @param {Array} intervals.keyIndices - array of index to key conversions
     * @param {number} spacingRad - space between chr arcs in radians
     * @return {Object} genoCoords - data and functions needed to render circos plot elements
     */
    SynUtils.makeGenoCoords = function(intervals, spacingRad) {
        let genoCoords = {
            chrIntervals: intervals
        };

        // array of d3 scales to apply given the size of the chr and 360 degrees
        let genoToRadianScales = [];

        let totalAccumLen = 0;
        for (let i = 0; i < intervals.length; i++) {
            totalAccumLen += intervals.valueAt(i).size;
        }
        let radiansPerUnit =
            (2.0 * Math.PI - spacingRad * intervals.length) /
            totalAccumLen;

        // using radians per unit,calculate all of the scales that map from genomic units to radians
        let accumLen = 0;
        for (let i = 0; i < intervals.length; i++) {

            let currInterval = intervals.valueAt(i);
            let currOffsetRad = spacingRad * i + accumLen * radiansPerUnit;

            // rotate 3/4 so that the 1st chromosome starts at the top
            currOffsetRad = SynUtils.clampRad(currOffsetRad + 1.5 * Math.PI);

            let currLenRad = radiansPerUnit * currInterval.size;
            let scale = d3.scale.linear()
                    .domain([0, currInterval.size])
                    .range([currOffsetRad, currOffsetRad + currLenRad]);

            genoToRadianScales.push(scale);

            accumLen += currInterval.size;
        }
        genoCoords.genoToRadianScales = genoToRadianScales;

        /**
         * converts from the given genome position to radians
         *
         * @param {string} chr - chromosome
         * @param {number} pos - position
         * @returns {number} - position in radians
         */
        genoCoords.genoPosToRadians = function(chr, pos) {
            let chrIdx = this.chrIntervals.keyIndices[chr];
            let chrScale = this.genoToRadianScales[chrIdx];

            return chrScale(pos);
        };

        /**
         * converts a radius and genomic position into a cartesian position (where 0,0 is the center)
         *
         * @param {number} radius - radius
         * @param {string} chr - chromsome
         * @param {number} pos - position
         * @returns {Object} - cartesian coordinates for position
         */
        genoCoords.genoPosToCartesian = function(radius, chr, pos) {
            let radPos = this.genoPosToRadians(chr, pos);
            return SynUtils.polarToCartesian(radius, radPos);
        };

        /**
         * converts a position given in radians to a genomic position
         *
         * @param {number} rad - radians to convert to a position
         * @returns {Object || null} - the genomic position or null if there is no valid genome
         *                             position for the given rad
         */
        genoCoords.radiansToGenoPos = function(rad) {
            for(let i = 0; i < this.chrIntervals.length; i++) {
                let chrScale = this.genoToRadianScales[i];
                let startRad = chrScale.range()[0];
                let stopRad = chrScale.range()[1];

                let adj_rad = rad;
                if(adj_rad < startRad) {
                    adj_rad += 2.0 * Math.PI;
                }

                if(startRad <= adj_rad && adj_rad <= stopRad) {
                    return {
                        'chr': this.chrIntervals.keys[i],
                        'pos': Math.round(chrScale.invert(adj_rad))
                    };
                }
            }

            return null;
        };

        return genoCoords;
    };

    /**
     * converts radians to degrees
     *
     * @param {number} rad - radians
     * @return {number} - value in degrees
     */
    SynUtils.radToDeg = function(rad) {
        return 180.0 * rad / Math.PI;
    };

    /**
     * converts degrees to radians
     *
     * @param {number} deg - degrees
     * @returns {number} - value in radians
     */
    SynUtils.degToRad = function(deg) {
        return Math.PI * deg / 180.0;
    };

    /**
     * converts polar coordinates to cartesian coordinates
     *
     * @param {number} radius - radius
     * @param {number} thetaRad - position in radians
     * @returns {Object} - x and y values for cartesian coordinates
     */
    SynUtils.polarToCartesian = function(radius, thetaRad) {
        return {
            "x" : Math.cos(thetaRad) * radius,
            "y" : Math.sin(thetaRad) * radius
        };
    };

    /**
     * returns a value that is the same angle as the given rad but forced between 0 and 2pi
     *
     * @param {number} rad - radians
     * @return {number} - clamped radian value
     */
    SynUtils.clampRad = function(rad) {
        rad %= 2.0 * Math.PI;
        if(rad < 0.0) {
            rad += 2.0 * Math.PI;
        }
        return rad;
    };

    /**
     * creates an array containing chr names and sizes
     *
     * @param {Object} chrSizes - interval pairs object
     * @return {Array} arcLines - object array of names and sizes
     */
    SynUtils.getGenoIntervals = function(chrSizes){
        let arcLines = [];
        for (let i = 0; i < chrSizes.length; i++) {
            arcLines.push({
                    chr: chrSizes.keys[i],
                    size: chrSizes.valueAt(i).size
                }
            );
        }
        return arcLines;
    };

    /**
     * generates a d3 path for an arc based on specified positions and sizes
     *
     * @param {number} innerEdge - smaller radius
     * @param {number} outerEdge - larger radius
     * @param {Object} genoCoords - functions and data to compute positions
     * @param {Object} genoInterval - position and size of arc to be rendered
     * @return {string} - d3 path
     */
    SynUtils.getArcPath = function(innerEdge, outerEdge, genoCoords, genoInterval) {
        let chrIdx = genoCoords.chrIntervals.keyIndices[genoInterval.chr];
        let chrScale = genoCoords.genoToRadianScales[chrIdx];

        let startRad;
        let stopRad;

        if(typeof genoInterval.startPos === "undefined") {
            startRad = chrScale(0);
            stopRad = chrScale(genoInterval.size);
        }
        else {
            startRad = chrScale(genoInterval.startPos);
            stopRad = chrScale(genoInterval.startPos + genoInterval.size);
        }

        let innerStartPos = this.polarToCartesian(innerEdge, startRad);
        let innerStopPos = this.polarToCartesian(innerEdge, stopRad);
        let outerStartPos = this.polarToCartesian(outerEdge, stopRad);
        let outerStopPos = this.polarToCartesian(outerEdge, startRad);

        // Path for an arc:
        // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
        // NOTE: sweep-flag=1 means "positive angle" and 0 means "negative angle"
        return (
            "M " + innerStartPos.x + " " + innerStartPos.y +
            " A " + innerEdge + " " + innerEdge + " 0 0 1 " + innerStopPos.x + " " + innerStopPos.y +
            " L " + outerStartPos.x + " " + outerStartPos.y +
            " A " + outerEdge + " " + outerEdge + " 0 0 0 " + outerStopPos.x + " " + outerStopPos.y +
            " Z");
    };

    /**
     * generates a d3 path for a chord based on specified positions and sizes
     *
     * @param {number} radius - radius
     * @param {Object} genoCoords - functions and data to compute positions
     * @param {Object} chordData - position and size of chord to be rendered
     * @return {string} - d3 path
     */
    SynUtils.getChordPath = function(radius, genoCoords, chordData) {
        let srcStartPos = genoCoords.genoPosToCartesian(radius, chordData.src.chr, chordData.src.pos);
        let srcEndPos = genoCoords.genoPosToCartesian(radius, chordData.src.chr, chordData.src.pos + chordData.src.size);
        let destStartPos = genoCoords.genoPosToCartesian(radius, chordData.dest.chr, chordData.dest.pos);
        let destEndPos = genoCoords.genoPosToCartesian(radius, chordData.dest.chr, chordData.dest.pos + chordData.dest.size);

        return (
            "M " + srcStartPos.x + "," + srcStartPos.y +
            "A 205, 205, 0 0, 1 " + srcEndPos.x + ", " + srcEndPos.y +
            "Q 0, 0 " + destEndPos.x + ", " + destEndPos.y +
            "A 205, 205, 0 0, 1 " + destStartPos.x + ", " + destStartPos.y +
            "Q 0,0 " + srcStartPos.x + "," + srcStartPos.y + "Z"
        );
    }

})(SynUtils || (SynUtils={}));