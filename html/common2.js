
function initialize(gotPos) {
  if (gotPos) {
    var myOptions = {
      zoom: 12,
      center: myLatLng,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    var map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

    var colors = ["#FF0000", "#0000FF", "#008000", "#808000", "#800080", "#008080"];
    var flightPlanCoordinates = [];
    var marker = [];
    var flightPath = [];

    for (j = 0; j < numDatas; ++j) {
      flightPlanCoordinates[j] = [];
      for (i = 0; i < lat[j].length; ++i)
        flightPlanCoordinates[j][i] = new google.maps.LatLng(lat[j][i], lng[j][i]);

      flightPath[j] = new google.maps.Polyline({
        path: flightPlanCoordinates[j],
        strokeColor: colors[j],
        strokeOpacity: 0.5,
        strokeWeight: 2
      });
      flightPath[j].setMap(map);
      marker[j] = new google.maps.Marker({position: flightPlanCoordinates[j][0], map: map});
    }
  }

  var plot;
  var rangemin;
  var rangemax;
  var plotvs = "time";

  var choiceContainer = $("#choices");

  for (j = 0; j < numDatas; ++j) {
      if (j > 0)
        choiceContainer.append('<br>');
      $.each(datasets, function(key, val) {
        choiceContainer.append('<input type="checkbox" name="' + key + j +
                               '" checked="checked"' +
                               //(key != "distance" ? '" checked="checked"' : '') +
                               ' id="id' + key + j + '">' +
                               '<label for="id' + key + j + '">'
                                + val.label + '</label>');
      });
  }

  choiceContainer.find("input").click(plotAccordingToChoices);

  function plotAccordingToChoices() {
    var data = [];

    choiceContainer.find("input:checked").each(function () {
      var key = $(this).attr("name");
      if (key) {
        key2 = key.slice(0, -1);
        index = key.slice(-1);
        if (datasets[key2]) {
            var min = Math.min.apply(null, datasets[key2].data[0]);
            var max = Math.max.apply(null, datasets[key2].data[0]);

            // BUG: Includes all datas in min and max, even those that are not shown
            for (j = 1; j < numDatas; ++j) {
              min = Math.min(min, Math.min.apply(null, datasets[key2].data[j]));
              max = Math.max(max, Math.max.apply(null, datasets[key2].data[j]));
            }

            var dat = [];
            if (datasets[key2].data[index] != null) {
                for (i = 0; i < datasets[key2].data[index].length; ++i) {
                  if (min != max) {
                    if (plotvs == "time") {
                      dat.push([startTime[index]+2*60*60*1000+time[index][i], 
                               (datasets[key2].data[index][i]-min)/(max-min)]);
                    }
                    else {
                      dat.push([distanceData[index][i], 
                               (datasets[key2].data[index][i]-min)/(max-min)]);
                      }
                
                   }
                }
            }

            var color = [];
            color.distance = 1;
            color.heartrate = 2;
            color.speed = 3;
            color.cadence = 4;
            color.altitude = 5;

            data.push({data: dat, 
                       serie: index, 
                       color: color[key2] + index*5 });
        }
      }
    });
    

    if (data.length > 0) {
      plot = $.plot($("#placeholder"), data, {
         crosshair: { mode: "x" },
         grid: { hoverable: true, autoHighlight: false },
         xaxis: { mode: plotvs == "time" ? "time" : null,
                  min: rangemin, 
                  max: rangemax, 
                  zoomRange: [null, rangemax-rangemin],
                  panRange: [rangemin, rangemax] },
         yaxis: { min: 0, 
                  max: 1,
                  zoomRange: [1, 1],
                  panRange: [1, 1] },
         zoom: { interactive: true },
         pan: { interactive: true }
      });
    }
  }

  var updateTimeout = null;
  var latestPosition = null;

  String.prototype.startsWith = function(str)
  {return (this.match("^"+str)==str)}

  function updatePlot() {
    updateTimeout = null;

    var pos = latestPosition;

    var axes = plot.getAxes();
    if (pos.x < axes.xaxis.min || pos.x > axes.xaxis.max ||
      pos.y < axes.yaxis.min || pos.y > axes.yaxis.max)
      return;

    var i, j, dataset = plot.getData();

    // find time

    var index = [];
    for (i = 0; i < numDatas; ++i) {
      // todo: binary search
      if (plotvs == "time") {
          var t = pos.x - 2*60*60*1000 - startTime[i];
          for (j = 0; j < time[i].length; ++j) {
            if (time[i][j] >= t) {
              index[i] = j == 0 ? 0 : j-1;
              break;
            }
          }
      }
      else {
        for (j = 0; j < distanceData[i].length; ++j) {
          if (distanceData[i][j] >= pos.x) {
            index[i] = j == 0 ? 0 : j-1;
            break;
          }
        }
      }
    }

    // update position on map

    if (gotPos) {
      for (i = 0; i < numDatas; ++i) {
        if (index[i] < posindex[i].length)
          idx = posindex[i][index[i]];
        else
          idx = posindex[i][posindex[i].length-1];
        if (idx >= flightPlanCoordinates[i].length)
          idx = flightPlanCoordinates[i].length-1;
        marker[i].setPosition(flightPlanCoordinates[i][idx]);
      }
    }

    // update current time

    for (i = 0; i < numDatas; ++i) {
      var j = index[i];
      if (j < time[i].length) {
          var dateobj = new Date(startTime[i]+time[i][j]); 
          var hh = dateobj.getHours();
          if (hh < 10) hh = new String("0" + hh);
          var mm = dateobj.getMinutes();
          if (mm < 10) mm = new String("0" + mm);
          var ss = dateobj.getSeconds();
          if (ss < 10) ss = new String("0" + ss);
          $("#spantime").text(hh+":"+mm+":"+ss);
          break;
      }
    }

    // update legends

    for (k = 0; k < numDatas; ++k) {
      var j = index[k];

      if (j < time[k].length) {
          var dateobj = new Date(startTime[k]+time[k][j]); 
          var hh = dateobj.getHours();
          if (hh < 10) hh = new String("0" + hh);
          var mm = dateobj.getMinutes();
          if (mm < 10) mm = new String("0" + mm);
          var ss = dateobj.getSeconds();
          if (ss < 10) ss = new String("0" + ss);
          $("#spantime"+k).text(hh+":"+mm+":"+ss);
      }

      if (distanceData[k] != null && j < distanceData[k].length)
        $("#spandistance"+k).text(distanceData[k][j].toFixed(1));
      else
        $("#spandistance"+k).text("-");

      if (heartrateData[k] != null && j < heartrateData[k].length)
        $("#spanheartrate"+k).text(heartrateData[k][j].toFixed(0));
      else
        $("#spanheartrate"+k).text("-");

      if (speedData[k] != null && j < speedData[k].length) {
        var tmp;
        if (speedData[k][j] == 0)
          tmp = 0;
        else
          tmp = 1000/(60*speedData[k][j]);

        var tmm = new String(Math.floor(tmp));
        if (tmm.length == 1) tmm = "0" + tmm;
        var tss = new String(Math.round((tmp-Math.floor(tmp))*60));
        if (tss.length == 1) tss = "0" + tss;
        $("#spanspeed"+k).text(tmm + ":" + tss);
      }
      else
        $("#spanspeed"+k).text("-");

      if (altitudeData[k] != null && j < altitudeData[k].length)
        $("#spanaltitude"+k).text(altitudeData[k][j].toFixed(1));
      else
        $("#spanaltitude"+k).text("-");

      if (cadenceData[k] != null && j < cadenceData[k].length)
        $("#spancadence"+k).text(cadenceData[k][j].toFixed(1));
      else
        $("#spancadence"+k).text("-");
    }
    plot.draw();
  }

  // enable mouse hovering

  $("#placeholder").bind("plothover",  function (event, pos, item) {
    latestPosition = pos;
    if (!updateTimeout)
      updateTimeout = setTimeout(updatePlot, 50);
  });

  $("#placeholder").bind("plotclick",  function (event, pos, item) {
    latestPosition = pos;
    alert("click");
    if (!updateTimeout)
      updateTimeout = setTimeout(updatePlot, 50);
  });

//  // enable mouse selection

//  $("#placeholder").bind("plotselected", function (event, ranges) {
//    var data = [];
//    choiceContainer.find("input:checked").each(function () {
//      var key = $(this).attr("name");
//      if (key && datasets[key])
//        data.push(datasets[key]);
//    });
//    rangemin = ranges.xaxis.from;
//    rangemax = ranges.xaxis.to;
//    plotAccordingToChoices();
//  });

  // handle zoom-out button

  $("#zoomout").click(function () {
    plotAccordingToChoices();
  });

  $("#plotvstime").click(function () {
    plotvs = "time";
    rangemin = startTime[0];
    rangemax = startTime[0]+time[0][time[0].length-1];
    for (j = 1; j < numDatas; ++j)
      rangemax = Math.max(rangemax, startTime[j]+time[j][time[j].length-1]);
    rangemin += 2*60*60*1000;
    rangemax += 2*60*60*1000;
    plotAccordingToChoices();
  });

  $("#plotvsdistance").click(function () {
    plotvs = "distance";
    rangemin = distanceData[0][0];
    rangemax = distanceData[0][distanceData[0].length-1];
    for (j = 1; j < numDatas; ++j)
      rangemax = Math.max(rangemax, distanceData[j][distanceData[j].length-1]);
    plotAccordingToChoices();
  });

  // default range: min and max distance over all measuers

  rangemin = startTime[0];
  rangemax = startTime[0]+time[0][time[0].length-1];
  for (j = 1; j < numDatas; ++j)
    rangemax = Math.max(rangemax, startTime[j]+time[j][time[j].length-1]);
  rangemin += 2*60*60*1000;
  rangemax += 2*60*60*1000;

  plotAccordingToChoices();
}