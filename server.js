'use strict';

const express = require('express');
const superagent = require('superagent');
const cors = require('cors');
const app = express();
const pg = require('pg');

app.use(cors());
require('dotenv').config();
const PORT = process.env.PORT || 3000;

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();

app.use(express.static('./'));

app.get('/', (request, response) => {
  response.status(200).send('Connected!');
});

app.get('/location', queryLocation);

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
      let insertSQL = 'INSERT INTO locations ( search_query, formatted_query, latitude, longitude ) VALUES ( $1, $2, $3, $4 );';
      let insertParams = [ location.search_query, location.formatted_query, location.latitude, location.longitude ];
      client.query(insertSQL, insertParams);
      // return location;
      response.send(location);
    })
    .catch(error => handleError(error, response));
}

//find in location table function
function queryLocation(request,response){
  let sql = 'SELECT * FROM locations WHERE search_query = $1;';
  let params = [ request.query.data ];
  return client.query(sql, params).then( result => {
    console.log(request.query.data);
    if(result.rowCount > 0){
      
      console.log(result.rows[0]);
      
      response.send(result.rows[0]);
    }else{
      locationApp(request,response);
    }
  });
}

function queryTable(table,params){
  let sqlLoc = 'SELECT location_id FROM locations WHERE search_query = $2;';
  let sql = 'SELECT * FROM $1 WHERE search_query = $2;';
  let params = [ request.query.data ];
  return client.query(sql, params).then( result => {
    console.log(request.query.data);
    if(result.rowCount > 0){
      
      console.log(result.rows[0]);
      
      response.send(result.rows[0]);
    }else{
      locationApp(request,response);
    }
  });
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
