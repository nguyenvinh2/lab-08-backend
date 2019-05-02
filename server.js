'use strict';

const express = require('express');
const superagent = require('superagent');
const cors = require('cors');
const app = express();

app.use(cors());
require('dotenv').config();
const PORT = process.env.PORT || 3000;

app.use(express.static('./'));

app.get('/', (request, response) => {
  response.status(200).send('Connected!');
});

app.get('/location', locationApp);

app.get('/weather', weatherApp);

app.get('/events', eventsApp);

//uses google API to fetch coordinate data to send to front end using superagent
//has a catch method to handle bad user search inputs in case google maps cannot
//find location
function locationApp(request, response) {
  const googleMapsUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(googleMapsUrl)
    .then(result => {
      const location = new Location(request, result);
      response.send(location);
    })
    .catch(error => handleError(error, response));
}

//creates darksky API url, then uses superagent to make call
//then generates array of "Weather" objects to send to front end
function weatherApp(req, res) {
  const darkSkyUrl = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;
  return superagent.get(darkSkyUrl)
    .then(result => {
      //make map one liner
      const weatherSummaries = result.body.daily.data.map(day => new Weather(day));
      res.send(weatherSummaries);
    })
    .catch(error => handleError(error, res));
}

function eventsApp(req, res) {
  const eventBriteUrl = `https://www.eventbriteapi.com/v3/events/search/?location.within=10mi&location.latitude=${req.query.data.latitude}&location.longitude=${req.query.data.longitude}&token=${process.env.EVENTBRITE_API_KEY}`;
  return superagent.get(eventBriteUrl)
    .then(result => {
      const eventSummaries = result.body.events.map(event => new Event(event));
      res.send(eventSummaries);
    })
    .catch(error => handleError(error, res));
}

function handleError(err, res) {
  if (res) res.status(500).send('Internal 500 error!');
}

function Weather(day) {
  this.time = new Date(day.time * 1000).toDateString();
  this.forecast = day.summary;
  this.created_at = Date.now();
}

//Refactored to pass more concise arguments
function Location(request, result) {
  this.search_query = request.query.data;
  this.formatted_query = result.body.results[0].formatted_address;
  this.latitude = result.body.results[0].geometry.location.lat;
  this.longitude = result.body.results[0].geometry.location.lng;
}

function Event(data) {
  this.link = data.url;
  this.name = data.name.text;
  this.event_date = new Date(data.start.local).toDateString();
  this.summary = data.description.text;
  this.created_at = Date.now();
}

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
