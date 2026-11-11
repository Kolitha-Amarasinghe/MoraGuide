require('dotenv').config();

const { closeDatabase, connectToDatabase, run } = require('../config/db');

const places = [
    { name: 'Main Gate', category: 'Gates', lat: 6.7951, lng: 79.9009, description: 'Main entrance to the University of Moratuwa campus.', icon: 'fa-door-open' },
    { name: 'University Library', category: 'Study', lat: 6.7971, lng: 79.9015, description: 'Campus library and study spaces. Check campus notices for opening hours.', icon: 'fa-book-open' },
    { name: 'Student Centre', category: 'Student services', lat: 6.7965, lng: 79.9030, description: 'Student services and common campus facilities.', icon: 'fa-users' },
    { name: 'Main Canteen', category: 'Food', lat: 6.7944, lng: 79.9027, description: 'Campus dining. Check locally for current service hours.', icon: 'fa-utensils' },
    { name: 'Medical Centre', category: 'Student services', lat: 6.7929, lng: 79.9017, description: 'Campus medical services. Contact the university for current hours and emergency information.', icon: 'fa-kit-medical' },
    { name: 'Main Auditorium', category: 'Campus buildings', lat: 6.7968, lng: 79.8998, description: 'Auditorium and event venue on campus.', icon: 'fa-building' },
    { name: 'Engineering Faculty', category: 'Faculties', lat: 6.7977, lng: 79.9031, description: 'Engineering faculty area. Check your timetable for the specific department or building.', icon: 'fa-gears' },
    { name: 'Architecture Faculty', category: 'Faculties', lat: 6.7948, lng: 79.8985, description: 'Architecture faculty area. Confirm your destination building with your department.', icon: 'fa-compass-drafting' },
    { name: 'Information Technology Faculty', category: 'Faculties', lat: 6.7983, lng: 79.8997, description: 'Information Technology faculty area. Confirm your destination building with your department.', icon: 'fa-laptop-code' },
    { name: 'Sports Ground', category: 'Sports', lat: 6.7928, lng: 79.8994, description: 'Campus sports and recreation area.', icon: 'fa-futbol' },
    { name: 'University Bus Stop', category: 'Transport', lat: 6.7942, lng: 79.8977, description: 'University bus stop area. Check current routes and timetables locally.', icon: 'fa-bus' },
    { name: 'Student Hostels', category: 'Student services', lat: 6.7918, lng: 79.9026, description: 'Student hostel area. Access may be restricted to residents and visitors.', icon: 'fa-bed' }
];

const faqs = [
    { question: 'Where is the library?', answer: 'Search for University Library in the campus directory or choose Study spaces in Student essentials to see it on the map.' },
    { question: 'Where can I find food on campus?', answer: 'Search for Main Canteen in the campus directory. Check locally for current opening hours and services.' },
    { question: 'How do I get walking directions?', answer: 'Select a place on the map or directory, then choose Get walking directions to open Google Maps.' },
    { question: 'Are the map routes and walking times exact?', answer: 'Map locations and distance estimates are illustrative. Follow the directions in your map app and confirm building details with the university.' }
];

async function seed() {
    await connectToDatabase();

    for (const place of places) {
        await run(`
            INSERT OR IGNORE INTO place (placeName, category, description, latitude, longitude, icon)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [place.name, place.category, place.description, place.lat, place.lng, place.icon]);
    }
    for (const faq of faqs) {
        await run(`
            INSERT OR IGNORE INTO faq (question, answer)
            VALUES (?, ?)
        `, [faq.question, faq.answer]);
    }

    console.log(`Seed complete: ${places.length} places and ${faqs.length} FAQs.`);
}

seed()
    .catch(error => {
        console.error('Database seeding failed:', error);
        process.exitCode = 1;
    })
    .finally(() => closeDatabase().catch(error => {
        console.error('Failed to close database:', error);
        process.exitCode = 1;
    }));
