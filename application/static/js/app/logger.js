"use strict";

let Logger;

(function(Logger) {

    Logger.Log = (function() {

        /**
         * @constructor
         */
        function Log() {
            let log = [];
            let logWindow = null;
            let doc;

            /**
             * opens the log window if it isn't already open
             */
            this.openLog = function() {
                let that = this;
                if(!that.isLogOpen()) {
                    logWindow = window.open("", "", "width=550, height=450");
                    doc = logWindow.document;

                    doc.write("<div id='wrapper' style='margin: 0 auto'>" +
                                  "<div id='top'>" +
                                      "<button id='download' style='position:fixed;'>Download Log</button>" +
                                  "</div>" +
                                  "<div id='content' style='padding-top: 20px;'></div>" +
                              "</div>");

                    if(log.length > 0) {
                        log.forEach(function(e) {
                            that.writeToLog(e);
                        });
                    }

                    doc.getElementById("download").onclick = function() {
                        that.downloadLog();
                    };
                }
            };

            /**
             * downloads the contents of the log into a txt file
             */
            this.downloadLog = function() {
                let a = doc.getElementById("content").appendChild(logWindow.document.createElement("a"));
                let time = Date.now();
                    a.download = "synteny-log-" + time + ".txt";
                    a.href = "data:text/html," + doc.getElementById("content").innerText;
                    a.click();
            };

            /**
             * closes the log window
             */
            this.closeLog = function() {
                if(this.isLogOpen()) {
                    logWindow.close();
                    logWindow = null;
                }
            };

            /**
             * returns if the log is open
             *
             * @return {boolean}
             */
            this.isLogOpen = function() {
                // this is a forced boolean: returning logWindow would return a reference
                return !(!logWindow);
            };

            /**
             * returns the log (array of strings)
             *
             * @return {Array} - log
             */
            this.getLog = function() {
                return log;
            };

            /**
             * prints the message to the log window
             *
             * @param {string} msg - message to be written
             */
            this.writeToLog = function(msg) {
                let styling = "font-family:monospace; " +
                              "line-height:15px; " +
                              "width:100%; " +
                              "border-bottom:1px solid #485F6E; " +
                              "margin-bottom: -5px; " +
                              "padding-bottom: 8px;";

                let p = doc.getElementById("content").appendChild(logWindow.document.createElement("p"));
                p.setAttribute("style", styling);
                let msgSplit = msg.split("\n");
                msgSplit.forEach(function(e) {
                    p.appendChild(logWindow.document.createTextNode(e));
                    p.appendChild(logWindow.document.createElement("br"))
                });
            };

            /**
             * adds the message to the log and prints message to the log window if it's open
             *
             * @param {string} msg - message to be logged
             */
            this.logThis = function(msg) {
                if(logWindow) {
                    this.writeToLog(msg);
                }
                log.push(msg);
            };

            this.changeAllStatus("no data loaded", "rgb(153,153,153)");

            let that = this;

            /**
             * when the page throws a js error, change the status indicators and log the error
             *
             * @param {string} msg - error message
             * @param {string} url - url of the file in which the error occurred
             * @param {number} lineNo - line number of the error
             * @param {number} columnNo - column number of the error
             * @param {object} error - contains stacktrace for the error, if there is one
             */
            window.onerror = function(msg, url, lineNo, columnNo, error) {
                let splitURL = url.split("/");
                console.log(error);
                // ignore any errors thrown by d3 TODO: only ignore d3 errors where the source isn't one of our scripts
                if (splitURL[splitURL.length - 1] !== "d3.min.js") {
                    let stackTrace = "";
                    if (error) {
                        stackTrace += ("\n" + error.stack);
                    }
                    that.logThis(msg + "\n" + "Failed at line " + lineNo + " in " +
                        splitURL[splitURL.length - 1] + stackTrace);

                    that.changeAllStatus("internal error", SynUtils.errorStatusColor);
                }
            };

            /**
             * when the page is reloaded/refreshed, close the log window
             */
            window.onbeforeunload = function() {
                that.closeLog();
            }
        }

        /**
         * sets the text and color for the block view browser status indicator
         *
         * @param {string} msg - message to display in the indicator
         * @param {string} color - color for the indicator in rgb, no spaces
         */
        Log.prototype.changeBrowserStatus = function(msg, color) {
            let browserStatus = d3.select("#browser-status");

            browserStatus.style("background-color", color);

            let parsedColor = color.substr(4).replace(/[)]/g, "").split(",");

            browserStatus.selectAll(".msg")
                .style("color", determineTextColor(parsedColor))
                .text(msg.toUpperCase());

        };

        /**
         * sets the text and color for the block view filter status indicator
         *
         * @param {string} msg - message to display in the indicator
         * @param {string} color - color for the indicator in rgb, no spaces
         */
        Log.prototype.changeFilterStatus = function(msg, color) {
            let filterStatus = d3.select("#filter-status");

            filterStatus.style("background-color", color);

            let parsedColor = color.substr(4).replace(/[)]/g, "").split(",");

            filterStatus.selectAll(".msg")
                .style("color", determineTextColor(parsedColor))
                .text(msg.toUpperCase());

        };

        /**
         * sets the text and color for both status indicators
         *
         * @param {string} msg - message to display in the indicator
         * @param {string} color - color for the indicator in rgb, no spaces
         */
        Log.prototype.changeAllStatus = function(msg, color) {
            this.changeBrowserStatus(msg, color);
            this.changeFilterStatus(msg, color);

        };

        /**
         * determines what the text color should be for the indicators based on
         * the luminance of the passed background color
         *
         * @param {Array} rgb - array with three values: r, g, b
         * @return {string} - color the text should be
         */
        function determineTextColor(rgb) {
            // calculate luminance value of the background color
            let luminance = 1 - (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;

            if(luminance < 0.5) {
                return "black";
            }
            else {
                return "white";
            }
        }

        return Log
    })();

})(Logger || (Logger = {}));