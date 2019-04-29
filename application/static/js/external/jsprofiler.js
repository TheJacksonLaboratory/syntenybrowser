var context = window;

(function() {
	
	var utils, testEl, trimRegExp;
	
	function JsProfiler() {
		this.profiling = false;
		this.reset();
	}
	
	this.JsProfiler = JsProfiler;
	
	JsProfiler.prototype = {
		constructor: JsProfiler,
		
		/**
		 * Resets all profile records.
		 */
		reset: function() {
			
			if (this.profiling) {
				throw new Error("Can't reset profiled data while profiler is running.");
			}
			
			this.leafRecord = {
				parentRecord: null,
				childRecords: {}
			};
			
			this.records = [];
			this.recordsPath = [];
		},
		
		/**
		 * Starts Profiler
		 */
		start: function() {
			
			if (this.profiling) {
				throw new Error("Can't start profiler, profiler is already started.");
			}
			
			this.profiling = true;
		},
		
		/**
		 * Stops Profiler
		 */
		stop: function() {
			
			if (this.leafRecord.parentRecord !== null) {
				throw new Error("Can't stop profiler until all registered functions executed.");
			}
			
			this.profiling = false;
		},
		
		_start: function(recordLabel) {

			if (!this.profiling) {
				return;
			}
			
			var measurement,
				record = this.leafRecord.childRecords[recordLabel];
			
			if (!record) {
				record = {
					measurements: [],
					parentRecord: this.leafRecord,
					childRecords: {}
				};
				this.leafRecord.childRecords[recordLabel] = record;
			}
			
			measurement = {
				start: Date.now(),
				end: null
			};
			
			record.measurements.push(measurement);
			
			this.records.push({
				name: recordLabel,
				parent: this.recordsPath.length ? this.recordsPath[this.recordsPath.length - 1] : null,
				measurement: measurement
			});
			
			this.recordsPath.push(this.records.length - 1);
			
			this.leafRecord = record;
		},
		
		_end: function(recordLabel) {
			
			if (!this.profiling) {
				return;
			}
			
			var record = this.leafRecord;
			
			if (record.parentRecord.childRecords[recordLabel] !== record) {
				throw new Error("Record '" + recordLabel + "' wasn't started, or isn't the last started record, or it's descendant records weren't ended!");
			}
			
			if (this.records[this.recordsPath[this.recordsPath.length - 1]].name !== recordLabel) {
				throw new Error("Record '" + recordLabel + "' wasn't started, or isn't the last started record, or it's descendant records weren't ended!");
			}
			
			this.recordsPath.pop();
			
			record.measurements[record.measurements.length - 1].end = Date.now();
			
			this.leafRecord = record.parentRecord;
		},
		
		wrapFunction: function(func, functionName) {
			
			var self = this;
			
			function F() {
				var returnValue;
				self._start(functionName);
				try {
					returnValue = func.apply(this, arguments);
					self._end(functionName);
					return returnValue;
				} catch (e) {
					self._end(functionName);
					throw e;
				}
			}
			
			return F;
		},
		
		/**
		 * Registers property of an object, which is a function or a getter-setter pair of functions, for being profiled.
		 * This function doesn't registers properties which are non function data descriptors, neither it registers non
		 * own properties. Therefore you can safely call this function on object properties from within for-in loop.
		 * 
		 * The profile data for that property will be denoted with passed objectLabel and propertyName.
		 * For example, if the objectLabel is "myObject" and property is a function "myFunction" then the profile data
		 * for that function will be denoted as "myObject.myFunction()". On the other hand if the property is a setter
		 * and getter function pairs called "myField" then the profile data for that property will be denoted as
		 * "myObject.get myField()" and "myObject.set myField()".
		 * 
		 * If fourth, "onObject", parameter isn't passed, then the new registered property, which is a wrapping function
		 * of the original property, will override the original property. Otherwise the new registered property will be
		 * set on "onObject". This parameter is useful when registering classes. Because when constructor function is
		 * registered, all its class members remain on the original function and not reachable from the registered
		 * constructor. Therefore, iterating over original constructor's own properties and registering them on a new
		 * registered constructor will make class members reachable.
		 * 
		 * @param {Object} object (required) Object with a property to register.
		 * @param {String} propertyName (required) Property name of a property to register.
		 * @param {String} objectLabel (required) Label to be used for denoting profiled property.
		 * @param {Object} [onObject="object"] Object on which to set registered property.
		 *                 If not specified, registered property overrides the original object's property.  
		 */
		registerFunction: function(object, propertyName, objectLabel, onObject) {
			var propertyDescriptor, getter, setter;
			
			propertyDescriptor = Object.getOwnPropertyDescriptor(object, propertyName);
			
			if (propertyDescriptor !== undefined) {
				if (onObject === undefined) {
					onObject = object;
				}
				
				if (typeof propertyDescriptor.value !== "undefined") {
					if (typeof propertyDescriptor.value === "function") {
						Object.defineProperty(onObject, propertyName, {
							configurable: propertyDescriptor.configurable,
							enumerable: propertyDescriptor.enumerable,
							writable: propertyDescriptor.writable,
							value: this.wrapFunction(propertyDescriptor.value, objectLabel + "." + propertyName + "()")
						});
					}
				} else if (typeof propertyDescriptor.get === "function" || typeof propertyDescriptor.set === "function") {
					if (typeof propertyDescriptor.get === "function") {
						getter = this.wrapFunction(propertyDescriptor.get, objectLabel + ".get " + propertyName + "()");
					} else {
						getter = propertyDescriptor.get;
					}
					if (typeof propertyDescriptor.set === "function") {
						setter = this.wrapFunction(propertyDescriptor.set, objectLabel + ".set " + propertyName + "()");
					} else {
						setter = propertyDescriptor.set;
					}
					Object.defineProperty(onObject, propertyName, {
						configurable: propertyDescriptor.configurable,
						enumerable: propertyDescriptor.enumerable,
						get: getter,
						set: setter
					});
				}
			}
		},

		/**
		 * Registers all function like properties of an object for being profiled.
		 * Function like properties include functions and getter-setter pairs.
		 * 
		 * @param {Object} object Object to register for profiling.
		 * @param {String} objectLabel Prefix to be used for denoting object's profiled properties.
		 */
		registerObject: function(object, objectLabel) {
			var propertyName;
			
			for (propertyName in object) {
				if (object.hasOwnProperty(propertyName)) {
					this.registerFunction(object, propertyName, objectLabel);
				}
			}
		},

		/**
		 * Registers class constructor and its instance and static functions to be profiled by the profiler.
		 * Registered function include getter-setter pairs.
		 * 
		 * This function doesn't overwrite passed class. It only wraps it and returns the wrapping class.
		 * 
		 * @param {Function} cls Class to be registered
		 * @param {String} className Prefix to be used for denoting object's profiled properties.
		 * @return {Function} Registered class
		 */
		wrapClass: function(cls, className) {
			var newClass, propertyName;
			
			newClass = this.wrapFunction(cls, className + ".constructor()");
			newClass.prototype = cls.prototype;
			newClass.prototype.constructor = newClass;
			
			// Wrapping newClass prototype methods also wraps originalClass prototype methods as they share same prototype object.
			for (propertyName in newClass.prototype) {
				// Wrap only own properties and don't wrap custom defined constructor because we have already wrapped class constructor.
				if (newClass.prototype.hasOwnProperty(propertyName) && propertyName !== "constructor") {
					this.registerFunction(newClass.prototype, propertyName, className);
				}
			}
			
			for (propertyName in cls) {
				if (cls.hasOwnProperty(propertyName)) {
					this.registerFunction(cls, propertyName, className, newClass);
				}
			}
			
			return newClass;
		},

		/**
		 * Registers class constructor and its instance and static functions to be profiled by the profiler.
		 * Registered function include getter-setter pairs.
		 * 
		 * This function overwrites class in context object with new registered class.
		 * 
		 * @param {Object} context Object on which the class is defined.
		 * @param {String} className Name of the class as defined in context.
		 * @return {Function} Registered class.
		 */
		registerClass: function(context, className) {
			context[className] = this.wrapClass(context[className], className);
			return context[className];
		},
		
		getRecordAverage: function(record) {
			var measurements = record.measurements,
				i, total = 0;
			
			for (i = 0; i < measurements.length; i++) {
				total += measurements[i].end - measurements[i].start;
			}
			
			return {
				count: measurements.length,
				total: total,
				totalAverage: Math.round(total / measurements.length)
			};
		},
		
		getResults: function(record) {
			var recordLabel, result = {};
			
			if (!record) {
				record = this.leafRecord;
				for (recordLabel in record.childRecords) {
					if (record.childRecords.hasOwnProperty(recordLabel)) {
						result[recordLabel] = this.getResults(record.childRecords[recordLabel]);
					}
				}
			} else {
				result = this.getRecordAverage(record);
				result.children = {};
				result.totalChildrenTime = 0;
				for (recordLabel in record.childRecords) {
					if (record.childRecords.hasOwnProperty(recordLabel)) {
						result.children[recordLabel] = this.getResults(record.childRecords[recordLabel]);
						result.totalChildrenTime += result.children[recordLabel].total;
					}
				}
				result.self = result.total - result.totalChildrenTime;
				result.selfAverage = Math.round(result.self / result.count);
			}
			
			return result;
		}
	};
	
	/**
	 * @namespace HtmlTableGenerator shows JsProfiler results in a dialog.
	 * 
	 * @example
	 * var results = jsProfilerInstance.getResults();
	 * JsProfiler.HtmlTableGenerator.showTable(results);
	 */
	JsProfiler.HtmlTableGenerator = {
		styleElement: null,
		tableContainerElement: null,
		tableElm: null,
		treeTableBodyElement: null,
		plainTableBodyElement: null,
		currentTableBodyElement: null,
		currentType: null,
		dropDownButtonLabelElm: null,
		footerGroupElm: null,
		toggleChildren: function() {
			var rowElm, depth, fold, unfoldedLevel, currDepth;
			
			rowElm = this.parentNode.parentNode;
			depth = Number(rowElm.getAttribute("data-depth"));
			unfoldedLevel = depth + 1;
			
			if (rowElm.hasAttribute("data-unfolded")) {
				rowElm.removeAttribute("data-unfolded");
				utils.removeClass(rowElm, "unfolded");
				fold = true;
			} else {
				rowElm.setAttribute("data-unfolded", "true");
				utils.addClass(rowElm, "unfolded");
				fold = false;
			}
			
			rowElm = rowElm.nextSibling;
			while (rowElm && (currDepth = Number(rowElm.getAttribute("data-depth"))) > depth) {
				if (currDepth < unfoldedLevel) {
					unfoldedLevel = currDepth;
				}
				if (currDepth === unfoldedLevel) {
					if (rowElm.hasAttribute("data-unfolded")) {
						unfoldedLevel += 1;
					}
					if (fold) {
						utils.addClass(rowElm, "hidden");
					} else {
						utils.removeClass(rowElm, "hidden");
					}
				}
				rowElm = rowElm.nextSibling;
			}
		},
		toTableRow: function(dataArray, depth, hasChildren, header) {
			var i, rowElm, cellElm, unfoldElm;
			
			rowElm = document.createElement("tr");
			rowElm.setAttribute("data-depth", depth);
			
			if (depth !== 0) {
				utils.addClass(rowElm, "hidden");
			}
			
			for (i = 0; i < dataArray.length; i++) {
				if (header) {
					cellElm = document.createElement("th");
				} else {
					cellElm = document.createElement("td");
					if (i === 0) {
						cellElm.style.paddingLeft = (depth * 14 + 20) + "px";
					}
				}
				if (i === 0 && hasChildren) {
					unfoldElm = document.createElement("span");
					unfoldElm.className = "foldHandle";
					unfoldElm.addEventListener("click", this.toggleChildren, false);
					cellElm.appendChild(unfoldElm);
				}
				cellElm.appendChild(document.createTextNode(dataArray[i]));
				rowElm.appendChild(cellElm);
			}
			
			return rowElm;
		},
		generateTreeTableRows: function(results, depth) {
			var recordLabel, child, rowDataArray, rowElm, fragment, hasChildren;
			
			fragment = document.createDocumentFragment();
			
			for (recordLabel in results) {
				if (results.hasOwnProperty(recordLabel)) {
					rowDataArray = [
						recordLabel,
						results[recordLabel].count,
						results[recordLabel].total + "ms",
						results[recordLabel].totalAverage + "ms",
						results[recordLabel].self + "ms",
						results[recordLabel].selfAverage + "ms"
					];
					hasChildren = false;
					for (child in results[recordLabel].children) {
						if (results[recordLabel].children.hasOwnProperty(child)) {
							hasChildren = true;
							break;
						}
					}
					rowElm = this.toTableRow(rowDataArray, depth, hasChildren, false);
					fragment.appendChild(rowElm);
					fragment.appendChild(this.generateTreeTableRows(results[recordLabel].children, depth + 1));
				}
			}
			
			return fragment;
		},
		generatePlainTableRows: function(results, data) {
			var recordLabel, firstLevel = false, fragment, rowDataArray;
			
			if (data === undefined) {
				firstLevel = true;
				data = {};
			}
			
			for (recordLabel in results) {
				if (results.hasOwnProperty(recordLabel)) {
					if (data[recordLabel] === undefined) {
						data[recordLabel] = {
							count: 0,
							total: 0,
							self: 0
						};
					}
					data[recordLabel].count += results[recordLabel].count;
					data[recordLabel].total += results[recordLabel].total;
					data[recordLabel].totalAverage = Math.round(data[recordLabel].total / data[recordLabel].total);
					data[recordLabel].self += results[recordLabel].self;
					data[recordLabel].selfAverage = Math.round(data[recordLabel].self / data[recordLabel].total);
					
					this.generatePlainTableRows(results[recordLabel].children, data);
				}
			}
			
			if (firstLevel) {
				fragment = document.createDocumentFragment();
				for (recordLabel in data) {
					if (data.hasOwnProperty(recordLabel)) {
						rowDataArray = [
							recordLabel,
							data[recordLabel].count,
							data[recordLabel].total + "ms",
							data[recordLabel].totalAverage + "ms",
							data[recordLabel].self + "ms",
							data[recordLabel].selfAverage + "ms"
						];
						fragment.appendChild(this.toTableRow(rowDataArray, 0, false, false));
					}
				}
				return fragment;
			} else {
				return true;
			}
		},
		addStyleElement: function() {
			var css, cssTextNode;
			
			css = "" +
				".jsProfilerContainer { position: fixed; left: 0px; top: 0px; right: 0px; bottom: 0px; background-color: rgba(0, 0, 0, 0.5); } " +
				".jsProfilerContainer table { margin: 20px auto 0; border-collapse: separate; border-spacing: 0px; color: #333; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; line-height: 18px; border: 1px solid #DDD; -webkit-border-radius: 4px; -moz-border-radius: 4px; border-radius: 4px; background-color: #fff; -webkit-box-shadow: 0 0 10px rgba(0, 0, 0, 0.4); -moz-box-shadow: 0 0 10px rgba(0, 0, 0, 0.4); box-shadow: 0 0 10px rgba(0, 0, 0, 0.4); } " +
				".jsProfilerContainer table thead th, .jsProfilerContainer table tfoot td { font-weight: bold; background-color: #F9F9F9; } " +
				".jsProfilerContainer table thead th, .jsProfilerContainer table td { padding: 4px 10px; text-align: left; border-top: 1px solid #DDD; border-left: 1px solid #DDD; } " +
				".jsProfilerContainer table thead th:first-child, .jsProfilerContainer table td:first-child { border-left: 0px; } " +
				".jsProfilerContainer table thead tr:first-child th { border-top: 0px; } " +
				".jsProfilerContainer table tbody { font-family: monospace; } " +
				".jsProfilerContainer table tfoot td { padding-top: 3px; padding-bottom: 3px; } " +
				".jsProfilerContainer table tfoot .dropDown { display: inline-block; position: relative; } " +
				".jsProfilerContainer table tfoot .dropDown .dropDownButton { display: inline-block; cursor: pointer; margin: 0; padding: 2px 5px; font-size: 11px; font-weight: normal; line-height: 14px; background-color: whiteSmoke; text-shadow: 0 1px 1px rgba(255, 255, 255, 0.75); background-image: -ms-linear-gradient(top, white, #E6E6E6); background-image: -webkit-gradient(linear, 0 0, 0 100%, from(white), to(#E6E6E6)); background-image: -webkit-linear-gradient(top, white, #E6E6E6); background-image: -o-linear-gradient(top, white, #E6E6E6); background-image: linear-gradient(top, white, #E6E6E6); background-image: -moz-linear-gradient(top, white, #E6E6E6); background-repeat: repeat-x; border: 1px solid #CCC; border-color: rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.25); border-bottom-color: #B3B3B3; -webkit-border-radius: 4px; -moz-border-radius: 4px; border-radius: 4px; -webkit-box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.125), inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 1px 2px rgba(0, 0, 0, 0.05); -moz-box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.125), inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 1px 2px rgba(0, 0, 0, 0.05); box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.125), inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 1px 2px rgba(0, 0, 0, 0.05); } " +
				".jsProfilerContainer table tfoot .dropDown .dropDownButton .caret { display: inline-block; width: 0; height: 0; vertical-align: top; border-top: 4px solid black; border-right: 4px solid transparent; border-left: 4px solid transparent; content: ''; opacity: 0.3; margin-top: 5px; margin-left: 5px; } " +
				".jsProfilerContainer.nonTouch table tfoot .dropDown .dropDownButton:hover { background-color: #E6E6E6; background-position: 0 -15px; } " +
				".jsProfilerContainer.nonTouch table tfoot .dropDown .dropDownButton:hover .caret { opacity: 1; } " +
				".jsProfilerContainer table tfoot .dropDown .dropDownList { display: none; position: absolute; top: top: 100%; left: 0; min-width: 160px; padding: 4px 0; margin: 1px 0 0; list-style: none; background-color: white; border: 1px solid #CCC; -webkit-border-radius: 5px; -moz-border-radius: 5px; border-radius: 5px; -webkit-box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2); -moz-box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2); box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2); } " +
				".jsProfilerContainer table tfoot .dropDown .dropDownList li { display: block; cursor: pointer; padding: 3px 15px; font-size: 13px; font-weight: normal; line-height: 18px; color: #333; white-space: nowrap; } " +
				".jsProfilerContainer.nonTouch table tfoot .dropDown .dropDownList li:hover { color: white; background-color: #08C; } " +
				".jsProfilerContainer table tfoot .dropDown.open .dropDownButton { background-color: #E6E6E6; background-image: none; -webkit-box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05); -moz-box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05); box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05); } " +
				".jsProfilerContainer table tfoot .dropDown.open .dropDownButton .caret { opacity: 1; } " +
				".jsProfilerContainer table tfoot .dropDown.open .dropDownList { display: block; } " +
				".jsProfilerContainer table tr.hidden { display: none } " +
				".jsProfilerContainer table tr td .foldHandle { cursor: pointer; width: 9px; height: 12px; float: left; margin-left: -14px; margin-top: 3px; background-repeat: no-repeat; background-position: 0 0; background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAMCAYAAACwXJejAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYxIDY0LjE0MDk0OSwgMjAxMC8xMi8wNy0xMDo1NzowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNS4xIE1hY2ludG9zaCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDowM0MzQ0JGOUU5MDgxMUUxQjdGOUFCQUFGRTI3Mzc1MiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDowM0MzQ0JGQUU5MDgxMUUxQjdGOUFCQUFGRTI3Mzc1MiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjAzQzNDQkY3RTkwODExRTFCN0Y5QUJBQUZFMjczNzUyIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjAzQzNDQkY4RTkwODExRTFCN0Y5QUJBQUZFMjczNzUyIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+LEtmnwAAAOdJREFUeNpilpSUvM/Ly3vhy5cvDxlwAGYVFZUJf/78SeDk5DQAKj4BVPwRQ5G0tHQDFxcXAysrqwZQcSKQzQ5UeBBFkZSUVAOIwcLCwgA0jYORkdGBjY0tAGjqDZgTGI2Njf+jG//792+GT58+Mfz8+XMBkFuAVREMfPv2jeHz588PmRjwAKCndmzbti2FBZskNzf3HV9f3yklJSU7gdw7KIqYmZm/6OvrL5g1a9ZCkCTQEx/AnoIpEBUVPZKdnT3Rx8fnBFDyCYrRVlZWz7u7u/P///+vA8QcWB0HlLAAYgF8HgAIMAB3jFZzHiYJygAAAABJRU5ErkJggg==); } " +
				".jsProfilerContainer table tr.unfolded td .foldHandle { -webkit-transform: rotate(90deg); -moz-transform: rotate(90deg); -ms-transform: rotate(90deg); } ";
			
			cssTextNode = document.createTextNode(css);
			
			this.styleElement = document.createElement("style");
			this.styleElement.type = "text/css";
			this.styleElement.appendChild(cssTextNode);
			
			document.getElementsByTagName("head")[0].appendChild(this.styleElement);
		},
		showTableType: function(type) {
			
			if (type === this.currentType) {
				// If specified type is already shown return 
				return;
			}
			
			if (this.currentTableBodyElement) {
				this.currentTableBodyElement.parentNode.removeChild(this.currentTableBodyElement);
			}
			
			switch (type) {
				case "tree":
					this.dropDownButtonLabelElm.textContent = "tree";
					this.currentTableBodyElement = this.treeTableBodyElement;
					break;
				case "plain":
					this.dropDownButtonLabelElm.textContent = "plain";
					this.currentTableBodyElement = this.plainTableBodyElement;
					break;
				default:
			}
			
			this.footerGroupElm.parentNode.insertBefore(this.currentTableBodyElement, this.footerGroupElm);
			this.currentType = type;
		},
		generateDropDown: function() {
			var	self = this,
				opened = false,
				dropDownElm,
				dropDownButtonElm,
				dropDownListElm,
				treeDropDownListItem,
				plainDropDownListItem,
				caretElm;
			
			function toggleDropDownList(e) {
				if (this === document) {
					if (utils.isDescendantOf(e.target, dropDownElm)) {
						return;
					}
				}
				if (opened) {
					opened = false;
					utils.removeClass(dropDownElm, "open");
					document.removeEventListener(utils.isTouch ? "touchstart" : "mousedown", toggleDropDownList, false);
				} else {
					opened = true;
					utils.addClass(dropDownElm, "open");
					document.addEventListener(utils.isTouch ? "touchstart" : "mousedown", toggleDropDownList, false);
				}
			}
			
			dropDownButtonElm = document.createElement("div");
			dropDownButtonElm.className = "dropDownButton";
			this.dropDownButtonLabelElm = document.createElement("span");
			caretElm = document.createElement("span");
			caretElm.className = "caret";
			dropDownButtonElm.appendChild(this.dropDownButtonLabelElm);
			dropDownButtonElm.appendChild(caretElm);
			dropDownButtonElm.addEventListener("click", toggleDropDownList, false);
			treeDropDownListItem = document.createElement("li");
			treeDropDownListItem.appendChild(document.createTextNode("tree"));
			treeDropDownListItem.addEventListener("click", function (e) {
				toggleDropDownList(e);
				self.showTableType("tree");
			}, false);
			plainDropDownListItem = document.createElement("li");
			plainDropDownListItem.appendChild(document.createTextNode("plain"));
			plainDropDownListItem.addEventListener("click", function (e) {
				toggleDropDownList(e);
				self.showTableType("plain");
			}, false);
			dropDownListElm = document.createElement("ul");
			dropDownListElm.className = "dropDownList";
			dropDownListElm.appendChild(treeDropDownListItem);
			dropDownListElm.appendChild(plainDropDownListItem);
			dropDownElm = document.createElement("div");
			dropDownElm.className = "dropDown";
			dropDownElm.appendChild(dropDownButtonElm);
			dropDownElm.appendChild(dropDownListElm);
			
			return dropDownElm;
		},
		addTableElement: function() {
			
			var headerGroupElm,
				footerRowElm,
				footerCellElm;
			
			headerGroupElm = document.createElement("thead");
			headerGroupElm.appendChild(this.toTableRow(["Function", "Calls", "Total", "Total Average", "Self", "Self Average"], 0, false, true));
			
			footerCellElm = document.createElement("td");
			footerCellElm.setAttribute("colspan", 6);
			footerCellElm.appendChild(document.createTextNode("Table type: "));
			footerCellElm.appendChild(this.generateDropDown());
			
			footerRowElm = document.createElement("tr");
			footerRowElm.appendChild(footerCellElm);
			
			this.footerGroupElm = document.createElement("tfoot");
			this.footerGroupElm.appendChild(footerRowElm);
			
			this.tableElm = document.createElement("table");
			this.tableElm.appendChild(headerGroupElm);
			this.tableElm.appendChild(this.footerGroupElm);
			
			this.tableContainerElement = document.createElement("div");
			this.tableContainerElement.className = "jsProfilerContainer " + (utils.isTouch ? "touch" : "nonTouch");
			this.tableContainerElement.appendChild(this.tableElm);
		},
		handleEvent: function(event) {
			
			var touch = utils.isTouch ? event.changedTouches[0] : event;
			
			if (touch.currentTarget === document) {
				if (!utils.isDescendantOf(touch.target, this.tableElm)) {
					this.hideTable();
				}
			}
			
		},
		showTable: function(results) {
			
			this.treeTableBodyElement = document.createElement("tbody");
			this.treeTableBodyElement.appendChild(this.generateTreeTableRows(results, 0));
			this.plainTableBodyElement = document.createElement("tbody");
			this.plainTableBodyElement.appendChild(this.generatePlainTableRows(results));
			
			if (this.styleElement === null) {
				this.addStyleElement();
			}
			
			if (this.tableContainerElement === null) {
				this.addTableElement();
			}
			
			if (this.tableContainerElement.parentNode === null) {
				document.body.appendChild(this.tableContainerElement);
			}
			
			document.addEventListener(utils.isTouch ? "touchstart" : "mousedown", this, false);
			
			this.currentType = null;
			this.showTableType("tree");
		},
		hideTable: function() {
			document.removeEventListener(utils.isTouch ? "touchstart" : "mousedown", this, false);
			this.tableContainerElement.parentNode.removeChild(this.tableContainerElement);
		}
	};

	/**
	 * @namespace ConsoleTableGenerator prints JsProfiler results to console.
	 * 
	 * @example
	 * var results = jsProfilerInstance.getResults();
	 * JsProfiler.ConsoleTableGenerator.printResults(results);
	 */
	JsProfiler.ConsoleTableGenerator = {
		headerRow: ["Self", "Self Average", "Total", "Total Average", "Calls", "Function"],
		tableCellWidth: [10, 14, 10, 15, 10, 10],
		toTableRow: function(arr, center) {
			var i, tableRow = "", availableSpace, leftSpace, rightSpace, itemStrLength;
			for (i = 0; i < arr.length; i++) {
				if (i !== arr.length - 1) {
					itemStrLength = String(arr[i]).length;
					availableSpace = this.tableCellWidth[i] - itemStrLength;
					if (availableSpace >= 0) {
						if (center) {
							leftSpace = Math.ceil(availableSpace / 2);
						} else {
							leftSpace = 1;
						}
						rightSpace = availableSpace - leftSpace;
					} else {
						leftSpace = 0;
						rightSpace = 0;
					}
					tableRow += (i > 0 ? "|" : "") + new Array(leftSpace + 1).join(" ") + arr[i] + new Array(rightSpace + 1).join(" ");
				} else {
					tableRow += "| " + arr[i];
				}
			}
			return tableRow;
		},
		generateTableRows: function(results, indentLevel) {
			var recordLabel, rowDataArray, output = "";
			
			for (recordLabel in results) {
				if (results.hasOwnProperty(recordLabel) && typeof results[recordLabel] === "object") {
					rowDataArray = [
						results[recordLabel].self + "ms",
						results[recordLabel].selfAverage + "ms",
						results[recordLabel].total + "ms",
						results[recordLabel].totalAverage + "ms",
						results[recordLabel].count,
						new Array(indentLevel + 1).join("    ") + recordLabel
					];
					output += "\n" + this.toTableRow(rowDataArray);
					output += this.generateTableRows(results[recordLabel].children, indentLevel + 1);
				}
			}
			
			return output;
		},
		generateResultsTable: function(results) {
			var output, i; 
				
			output = this.toTableRow(this.headerRow, true) + "\n";
			for (i = 0; i < this.tableCellWidth.length; i++) {
				output += new Array(this.tableCellWidth[i] + 2).join("-");
			} 
			output += this.generateTableRows(results, 0);
			
			return output;
		},
		printResults: function(results) {
			var output = this.generateResultsTable(results);
			console.log(output);
		}
	};
	
	testEl = document.createElement('div');
	trimRegExp = /^\s+|\s+$/g;
	utils = {
		isTouch: window.ontouchstart !== undefined,
		trim: function(str) {
			return str.replace(trimRegExp,"");
		},
		empty: function(element) {
			while (element.firstChild) {
				element.removeChild(element.firstChild);
			}	
		},
		isDescendantOf: function(descendant, ancestor) {
			while (descendant !== null && descendant !== ancestor) {
				descendant = descendant.parentNode;
			}
			if (descendant === null) {
				return false;
			} else {
				return true;
			}
		},
		hasClass: (testEl.classList !== undefined ?
			function (element, className) {
				return element.classList.contains(className);
			} :
			function (element, className) {
				return (new RegExp("\\b" + className + "\\b")).test(element.className);
			}),
		addClass: (testEl.classList !== undefined ?
			function (element, className) {
				var classesArray = utils.trim(className).split(/\s+/), i;
				for (i = 0; i < classesArray.length; i++) {
					element.classList.add(classesArray[i]);
				}
			} :
			function (element, className) {
				var classesArray = utils.trim(className).split(/\s+/), i;
	
				for (i = 0; i < classesArray.length; i++) {
					if (!utils.hasClass(element, classesArray[i])) {
						element.className += (element.className ? ' ' : '') + classesArray[i];
					}
				}
			}),
		removeClass: (testEl.classList !== undefined ?
			function (element, className) {
				var classesArray = utils.trim(className).split(/\s+/), i;
				for (i = 0; i < classesArray.length; i++) {
					element.classList.remove(classesArray[i]);
				}
			} :
			function (element, className) {
				var classesArray = utils.trim(className).split(/\s+/),
					classes, index, i;
	
				classes = utils.trim(element.className).split(/\s+/);
	
				for (i = 0; i < classesArray.length; i++) {
					index = classes.indexOf(classesArray[i]);
					if (index > -1){
						classes.splice(index, 1);
					}
				}
	
				element.className = classes.join(' ');
			})
	};
	
}).apply(context);