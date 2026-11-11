const path = require('node:path');

const profileImageDirectory = path.resolve(__dirname, '..', 'uploads', 'profile-images');
const profileImageUrlPrefix = '/uploads/profile-images/';

module.exports = {
    profileImageDirectory,
    profileImageUrlPrefix
};
