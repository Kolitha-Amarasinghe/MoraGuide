const Place = require('../models/placeModel');
const createResourceController = require('./resourceController');

module.exports = createResourceController(Place, [
    'name', 'category', 'description', 'lat', 'lng', 'icon'
], { sort: { name: 1 } });
