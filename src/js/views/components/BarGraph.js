const React = require('react');

/**
 * Bar plots, both stacked and normal.
 *
 * Displays simple and elegant bar plots that are just series of rectangles with no visible text that completely fill up a container div. When hovering over a bar, a tooltip appears with a complete annotation.
 *
 * Usage:
 *
 * CSS: Set the size of your bar graph (.my-plot here) and specify your colors. These colors were taken from Bootstrap. You only need as many colors as you have stacked components in your bar graphs (so, just .bar-graph-1 is used if you aren't stacking - the exception to this rule is that bar-graph-3 is used for negative values).
 *
 *     .my-plot { height: 80px; }
 *     .bar-graph-1 { background-color: #049cdb; }
 *     .bar-graph-2 { background-color: #f89406; }
 *     .bar-graph-3 { background-color: #9d261d; }
 *     .bar-graph-4 { background-color: #ffc40d; }
 *     .bar-graph-5 { background-color: #7a43b6; }
 *     .bar-graph-6 { background-color: #46a546; }
 *     .bar-graph-7 { background-color: #c3325f; }
 *
 * JavaScript:
 *
 *     <BarGraph
 *         data={data}
 *         labels={labels}
 *         tooltipCb={val => `whatever ${val}`}
 *         ylim={[0, 1]}
 *     />
 *
 * @param {Array} data For a non-stacked bar graph, an array of data values which will be transformed to heights. For a stacked bar graph, an array of arrays, where each internal array is as described in the previous sentence. The first one will be the bottom in the stack, the last will be the top. For stacked bar graphs, all values must be positive. For non-stacked bar graphs, positive and negative values are allowed
 * @param {Array=} labels For a non-stacked bar graph, an array of text labels of the same size as data. For a stacked bar graph, an array of two arrays; the first is the same as described in the first sentence, and the second is an array of labels corresponding to the different stacked components. See the example below to make this more clear. If undefined, then no labels are shown in tooltips and just the data values are displayed.
 * @param {function(number)=} tooltipCb An optional function to process the data values when displayed in a tooltip. So if one of your values is 54.3876826 and you want to display it rounded, pass Math.round here.
 * @param {Array.<number>=} ylim An array of two numbers, the minimum and maximum values for the scale. If undefined, then this will be set to the minimum and maximum values of your data, plus 10% wiggle room and with either the maximum or minimum set to 0 if 0 is not in the range already (for a stacked graph, the default minimum is always 0 because all data is positive).
 *
 * Example JavaScript: Fitting with the HTML and CSS above...
 *
 * This will create a non-stacked bar plot, with positive and negative values shown in different colors. Tooltip labels will be like "2002: $15", "2003: $3", etc.
 *
 *     <BarGraph
 *         data={[15.2, 3, -5, 7.2]}
 *         labels={[2002, 2003, 2004, 2005]}
 *         tooltipCb={val => "$" + Math.round(val)}
 *         ylim={[-10, 20]}
 *     />
 *
 * This will create a stacked bar plot, with tooltip labels like "NJ Lions: 1", "NJ Tigers: 5", "NY Lions: 5", etc.
 *
 *     <BarGraph
 *         data={[[1, 5, 2], [5, 3, 1]]}
 *         labels={[["NJ", "NY", "PA"], ["Lions", "Tigers"]]}
 *     />
 *
 * This will just draw the same bars as above, but with no labels in the tooltips, so they will just be the numbers themselves.
 *
 *     <BarGraph
 *         data={[[1, 5, 2], [5, 3, 1]]}
 *     />
 */

// Default scale for bar chart. This finds the max and min values in the data, adds 10% in each direction so you don't end up with tiny slivers, and then expands the upper/lower lims to 0 if 0 wasn't already in the range.
const defaultYlim = (data, stacked) => {
    let min = Infinity;
    let max = -Infinity;

    // If stacked, add up all the components
    let x = [];
    if (stacked) {
        for (let i = 0; i < data[0].length; i++) {
            x[i] = 0;
            for (let j = 0; j < data.length; j++) {
                x[i] += data[j][i];
            }
        }
    } else {
        x = data;
    }

    for (let i = 0; i < x.length; i++) {
        if (x[i] < min) {
            min = x[i];
        }
        if (x[i] > max) {
            max = x[i];
        }
    }

    // Add on some padding
    min = min - 0.1 * (max - min);
    max = max + 0.1 * (max - min);

    // Make sure 0 is in range
    if (min > 0) {
        min = 0;
    }
    if (max < 0) {
        max = 0;
    }

    // For stacked plots, min is always 0
    if (stacked) {
        min = 0;
    }

    return [min, max];
};

const scale = (val, ylim) => {
    if (val > ylim[1]) {
        return 100;
    }
    if (val < ylim[0]) {
        return 0;
    }
    return (val - ylim[0]) / (ylim[1] - ylim[0]) * 100;
};

class BarGraph extends React.Component {

    render() {
        const {data = [], ylim: ylimArg, labels, tooltipCb = val => val} = this.props;

        if (data.length === 0) {
            return null;
        }

        const gap = 2;  // Gap between bars, in pixels

        // Stacked plot or not?
        const stacked = data[0].hasOwnProperty("length");

        const numBars = stacked ? data[0].length : data.length;
        const widthPct = 100 / numBars;

        // ylim specified or not?
        const ylim = ylimArg === undefined ? defaultYlim(data, stacked) : ylimArg;

        // Convert heights to percentages
        const scaled = [];
        for (let i = 0; i < data.length; i++) {
            if (!stacked) {
                scaled[i] = scale(data[i], ylim);
            } else {
                scaled[i] = [];
                for (let j = 0; j < data[i].length; j++) {
                    scaled[i][j] = scale(data[i][j], ylim);
                }
            }
        }

        // Draw bars
        if (!stacked) {
            // Not stacked
            return <div style={{height: '100%', marginLeft: '-${gap}px', position: 'relative'}}>
                {data.map((val, i) => {
                    let titleStart = '';
                    if (labels !== undefined) {
                        titleStart = `${labels[i]}: `;
                    }

                    // Fix for negative values
                    let bottom, cssClass, height;
                    if (val >= 0) {
                        bottom = scale(0, ylim);
                        height = scaled[i] - scale(0, ylim);
                        cssClass = 'bar-graph-1';
                    } else {
                        bottom = scaled[i];
                        height = scale(0, ylim) - scaled[i];
                        cssClass = 'bar-graph-3';
                    }

console.log('tooltip', titleStart + tooltipCb(val))
                    return <div key={i} className={cssClass} style={{
                        marginLeft: `${gap}px`,
                        position: 'absolute',
                        bottom: `${bottom}%`,
                        height: `${height}%`,
                        left: `${i * widthPct}%`,
                        width: `calc(${widthPct}% - ${gap}px)`,
                    }} />;
                })}
            </div>;
        }

        // Stacked
        const offsets = [];
        for (let j = 0; j < data.length; j++) {
            for (let i = 0; i < data[j].length; i++) {
                if (j === 0) {
                    offsets[i] = 0;
                } else {
                    offsets[i] += scaled[j - 1][i];
                }
                if (data[j][i] !== null && data[j][i] !== undefined) {
                    let titleStart = "";
                    if (labels !== undefined) {
                        titleStart = `${labels[0][i]} ${labels[1][j]}: `;
                    }
                    $("<div></div>", {"class": `bar-graph-${j + 1}`})
                        .data("num", i)
                        .css({
                            position: "absolute",
                            bottom: `${offsets[i]}%`,
                            height: `${scaled[j][i]}%`,
                        })
                        .tooltip({
                            title: titleStart + tooltipCb(data[j][i]),
                        })
                        .appendTo(container);
                }
            }
        }
    }
}

module.exports = BarGraph;
