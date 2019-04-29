"use strict";

let ColorLegend;

(function(ColorLegend) {

    ColorLegend.ColorLegendFactory = (function() {

        /**
         * @constructor
         *
         * @param id - comparison species id
         */
        function ColorLegendFactory(id) {
            this._species = id;

            this._colors = JaxSynteny.colors;
            this._compChromosomes = null;

            this.width = this._colors.length * 40;

            let that = this;
            this._legend = d3.select("#chr-color-legend")
                .attr("width", that.width);

        }

        /**
         * draws comparison chromosome color legend
         */
        ColorLegendFactory.prototype.drawLegend = function(compChr) {
            let that = this;

            that._compChromosomes = compChr;

            that.cleanUp();

            that.drawLegendCircles();

            that.drawLegendLabels();

            that._legend.append("text")
                .attr("y", 15)
                .attr("x", that.width/2)
                .style("text-anchor", "middle")
                .html(JaxSynteny.speciesComp.name + " Chromosome Color Key");

        };

        /**
         * draws colored circles of color legend; fades out colors that are not
         * in the current block view
         */
        ColorLegendFactory.prototype.drawLegendCircles = function() {
            let that = this;

            let circles = that._legend
                .selectAll("circle")
                .data(that._colors)
                .enter()
                .append("circle")
                .attr("cx", function(d, i) {
                    return ((i+1)*40) - 30;
                })
                .attr("cy", 40)
                .attr("r", 10)
                .attr("class", function(d) {
                    if (that.isInReferenceChr(d.chr)) {
                        return "c" + d.chr;
                    }
                    else {
                        return "";
                    }
                })
                .style("fill", function(d) {
                    if (that.isInReferenceChr(d.chr)) {
                        return d.color;
                    }
                    else {
                        return SynUtils.fadeColor(d.color, 0.25);
                    }
                });

            let activeCircles = circles.filter(function(e) {
                return that.isInReferenceChr(e.chr);
            });

            activeCircles.on("mouseover", function(e) {
                let blocks = d3.select("#block-view-svg")
                    .selectAll(".block")
                    .filter(function() {
                        return this.classList[1] !== ("c" + e.chr);
                    });

                blocks
                    .style("fill", "#eee")
                    .style("stroke", "#aaa");

            });

            activeCircles.on("mouseout", function(e) {
                let blocks = d3.select("#block-view-svg")
                    .selectAll(".block")
                    .filter(function() {
                        return this.classList[1] !== ("c" + e.chr);
                    });

                blocks
                    .style("fill", null)
                    .style("stroke", null);
            });
        };

        /**
         * draws colored labels of color legend; fades out labels of colors that
         * are not in the current block view
         */
        ColorLegendFactory.prototype.drawLegendLabels = function() {
            let that = this;

            let labels = that._legend
                .selectAll("text")
                .data(that._colors)
                .enter()
                .append("text")
                .attr("x", function(d, i) {
                    if(i >= 9 && i !== that._colors.length-1 && i !== that._colors.length-2) {
                        return ((i+1)*40-8) - 30;
                    } else {
                        return ((i+1)*40-5) - 30;
                    }
                })
                .attr("y", 70)
                .style("font-family", "sans-serif")
                .style("font-size", "15px")
                .attr("class", function(d) {
                    if (that.isInReferenceChr(d.chr)) {
                        return "c" + d.chr;
                    }
                    else {
                        return "";
                    }
                })
                .text(function(d) {
                    return d.chr;
                })
                .style("fill", function(d) {
                    let color = "#000000";

                    if (that.isInReferenceChr(d.chr)) {
                        return color;
                    }
                    else {
                        return SynUtils.fadeColor(color, 0.25);
                    }
                });

            let activeLabels = labels.filter(function(e) {
                return that.isInReferenceChr(e.chr);
            });

            activeLabels.on("mouseover", function(e) {
                let blocks = d3.select("#block-view-svg")
                    .selectAll(".block")
                    .filter(function() {
                        return this.classList[1] !== ("c" + e.chr);
                    });

                blocks
                    .style("fill", "#eee")
                    .style("stroke", "#aaa");

            });

            activeLabels.on("mouseout", function(e) {
                let blocks = d3.select("#block-view-svg")
                    .selectAll(".block")
                    .filter(function() {
                        return this.classList[1] !== ("c" + e.chr);
                    });

                blocks
                    .style("fill", null)
                    .style("stroke", null);
            });
        };

        /**
         * removes all existing elements in the current legend
         */
        ColorLegendFactory.prototype.cleanUp = function() {
            this._legend.selectAll("*").remove();
        };

        /**
         * determines whether the element should be highlighted or not based on
         * whether or not its associated color is in the current reference
         * chromosome
         *
         * @param i - index of element
         * @return {boolean} - whether the element at index i should be highlighted
         */
        ColorLegendFactory.prototype.isInReferenceChr = function(i) {
            return $.inArray(i, this._compChromosomes) !== -1;

        };

        return ColorLegendFactory
    })();

})(ColorLegend || (ColorLegend = {}));