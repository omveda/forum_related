/*
 * This is a sample code that shows how to render a Linemap with a Time Chart.
 * Also crossfilter works as we brush along the time chart.
 */

document.addEventListener("DOMContentLoaded", function init() {
    const config = {
      table: "vs_vehicle_test",
      geoMeasure: "transmissionLine",
      colorMeasure: "OBUid"
    }

  // A MapdCon instance is used for performing raw queries on a MapD GPU database.
  new MapdCon()
    .protocol("https")
    .host("use2-api.mapd.cloud") // Connect to OmniSci Cloud Host
    .port("443")
    .dbName("mapd")               // Default database
    .user("F0Axxxxx") // Enter from SETTINGS on cloud portal
    .password("fiNyyyyy")
    .connect(function(error, con) {
      var tableName1 = 'vs_vehicle_test';
      var crossFilter = crossfilter.crossfilter(con, tableName1).then(function(cf1) {
          createCharts(cf1, con)
        });
      });

  // function to create the backend-rendered map.
  function createCharts(linecfLayer1, con) {
    var w = document.documentElement.clientWidth - 30;
    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0) - 200;
    var mapboxToken = "pk.eyJ1IjoibWFwZCIsImEiOiJjaWV1a3NqanYwajVsbmdtMDZzc2pneDVpIn0.cJnk8c2AxdNiRNZWtx5A9g";

    /*---------------------BASIC COUNT ON CROSSFILTER--------------------------*/
    var countGroup1 = linecfLayer1.groupAll();
    var dataCount1 = dc.countWidget(".data-count1")
                       .dimension(linecfLayer1)
                       .group(countGroup1);

    // map bounding box filtering dimension
    const viewBoxDim = linecfLayer1.dimension(config.geoMeasure)
    const linecolorRange = [
      "rgba(234,174,239,1)",
      "rgba(189,174,239,1)",
      "rgba(179,174,239,1)",
      "rgba(39,174,239,1)"
    ]
    const linecolorDomain = [
      32,
      20,
      26,
      28 
    ]

    const bounds = {
      lonMin: -124.70126,
      lonMax: -66.82674,
      latMin: 27.937431,
      latMax: 49.467835
    }

    // crossfilter method to count number of lines within the map bounding box
    viewBoxDim.filterST_Min_ST_Max(bounds)

    const lineLayer = dc.rasterLayer("lines")
      .crossfilter(linecfLayer1)
      .setState({
        data: [{
          table: config.table,
          attr: "rowid"
        }],
        transform: {
          sample: true,
          limit: 100000,
          tableSize: 33589
        },
        mark: {
          type: "lines",
          lineJoin: "bevel"
        },
        encoding: {
          size: "auto",
          size: {
            type: "quantitative",
            field: "Speed",
            domain: [0, 30],
            range: [2, 7]
          },
          color: {
            type: "ordinal",
            field: config.colorMeasure,
            colorMeasureAggType: "# Unique",
            domain: linecolorDomain,
            range: linecolorRange,
            legend: {title: config.colorMeasure + ' ['+config.table+']', open: true}
          },
          geocol: config.geoMeasure,
          geoTable: config.table
        }
      })
      .viewBoxDim(viewBoxDim)
      .popupColumns(["OBUid", "Speed"])
      .popupColumnsMapped({})

     /*---------------------TIME CHART EXAMPLE----------------------------------*/

         var timeChartMeasures = [
         {
           expression: "timeTransmission",
           agg_mode:"min",
           name: "minimum"
         },
         {
           expression: "timeTransmission",
           agg_mode:"max",
           name: "maximum"}
         ]

         /* Note than when we are doing aggregations over the entire dataset we use
          * the crossfilter object itself as the dimension with the groupAll method
          *
          * values(true) gets the values for our groupAll measure (here min and max
          * of dep_timestamp) - true means to ignore currently set filters - i.e.
          * get a global min and max
          */
          linecfLayer1
           .groupAll()
           .reduce(timeChartMeasures)
           .valuesAsync(true).then(function(timeChartBounds) {

             var timeChartDimension = linecfLayer1.dimension("timeTransmission");

             /* We would like to bin or histogram the time values.  We do this by
              * invoking setBinParams on the group.  Here we are asking for 400 equal
              * sized bins from the min to the max of the time range
              */
             var timeChartGroup = timeChartDimension
               .group()
               .reduceCount()

           /*  We create the time chart as a line chart
            *  with the following parameters:
            *
            *  Width and height - as above
            *
            *  elasticY(true) - cause the y-axis to scale as filters are changed
            *
            *  renderHorizontalGridLines(true) - add grid lines to the chart
            *
            *  brushOn(true) - Request a filter brush to be added to the chart - this
            *  will allow users to drag a filter window along the time chart and filter
            *  the rest of the data accordingly
            *
            */

             var dcTimeChart = dc.lineChart('.time-chart')
               .width(w)
               .height(h/2.5)
               .elasticY(true)
               .renderHorizontalGridLines(true)
               .brushOn(true)
               .xAxisLabel('Message Transmission Time')
               .yAxisLabel('# Records')
               .dimension(timeChartDimension)
               .group(timeChartGroup)
               .binParams({
                  numBins: 400,
                  binBounds: [timeChartBounds.minimum, timeChartBounds.maximum]
                 });

             /* Set the x and y axis formatting with standard d3 functions */

             dcTimeChart
               .x(d3.time.scale.utc().domain([timeChartBounds.minimum, timeChartBounds.maximum]))
               .yAxis().ticks(5);

             dcTimeChart
               .xAxis()
               .scale(dcTimeChart.x())
               .tickFormat(dc.utils.customTimeFormat)
               .orient('top');
      });

    // grab the parent div.
    var parent = document.getElementById("chart1-example");

    var lineMapChart = dc.rasterChart(parent, true) // create a raster chart. true indicates a pointmap
                          .con(con)             // indicate the connection layer
                          .usePixelRatio(true)  // tells the widget to use the pixel ratio of the
                                                // screen for proper sizing of the backend-rendered image
                          .useLonLat(true)    // all point layers need their x,y coordinates, which
                                              // are lon,lat converted to mercator.
                          .height(h/1.25)  // set width/height
                          .width(w)
                          .mapUpdateInterval(750)
                          .mapStyle('mapbox://styles/mapbox/light-v8')
                          .mapboxToken(mapboxToken) // need a mapbox accessToken for loading the tiles

                          // add the layers to the pointmap
                          .pushLayer('pointtable2', lineLayer)

                          // and setup a buffer radius around the pixels for hit-testing
                          // This radius helps to properly resolve hit-testing at boundaries
                          .popupSearchRadius(2)
                          .useGeoTypes(true) // XXXX

    lineMapChart.init().then(function() {
      // now render the pointmap
      dc.renderAllAsync()


      /*---------------SETUP HIT-TESTING-------------*/
      // hover effect with popup
      // Use a flag to determine if the map is in motion
      // or not (pan/zoom/etc)
      var mapmove = false;

      // debounce the popup - we only want to show the popup when the
      // cursor is idle for a portion of a second.
      var debouncedPopup = _.debounce(displayPopupWithData, 250)
      lineMapChart.map().on('movestart', function() {
        // map has started moving in some way, so cancel
        // any debouncing, and hide any current popups.
        mapmove = true;
        debouncedPopup.cancel();
        lineMapChart.hidePopup();
      });

      lineMapChart.map().on('moveend', function(event) {
        // map has stopped moving, so start a debounce event.
        // If the cursor is idle, a popup will show if the
        // cursor is over a layer element.
        mapmove = false;
        debouncedPopup(event);
        lineMapChart.hidePopup();
      });

      lineMapChart.map().on('mousemove', function(event) {
        // mouse has started moving, so hide any existing
        // popups. 'true' in the following call says to
        // animate the hiding of the popup
        lineMapChart.hidePopup(true);

        // start a debound popup event if the map isn't
        // in motion
        if (!mapmove) {
          debouncedPopup(event);
        }
      })

      // callback function for when the mouse has been idle for a moment.
      function displayPopupWithData (event) {
        if (event.point) {
          // check the pointmap for hit-testing. If a layer's element is found under
          // the cursor, then display a popup of the resulting columns
          lineMapChart.getClosestResult(event.point, function(closestPointResult) {
            // 'true' indicates to animate the popup when starting to display
            lineMapChart.displayPopup(closestPointResult, true)
          });
        }
      }

      /*--------------------------RESIZE EVENT------------------------------*/
      /* Here we listen to any resizes of the main window.  On resize we resize the corresponding widgets and call dc.renderAll() to refresh everything */

      window.addEventListener("resize", _.debounce(reSizeAll, 500));

      function reSizeAll() {
        var w = document.documentElement.clientWidth - 30;
        var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0) - 150;

        lineMapChart
          .width(w)
          .height(h/1.25);

        dcTimeChart
          .width(w)
          .height(h/2.5);

        dc.redrawAllAsync();
      }
    })
  }

});
