DROP DATABASE IF EXISTS MoraGuide;
CREATE DATABASE IF NOT EXISTS moraguide;
USE moraguide;

-- ====================================
-- USERS TABLE
-- ====================================

CREATE TABLE users (
    userId INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(50) NOT NULL,
    lastName VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(15),
    role ENUM('student','organizer','admin') NOT NULL,
    profileImage VARCHAR(255),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- STUDENTS
-- ====================================

CREATE TABLE student (
    studentId INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    registrationNumber VARCHAR(30) UNIQUE NOT NULL,
    faculty VARCHAR(100),
    department VARCHAR(100),

    FOREIGN KEY (userId)
    REFERENCES users(userId)
    ON DELETE CASCADE
);

-- ====================================
-- EVENT ORGANIZERS
-- ====================================

CREATE TABLE organizer (
    organizerId INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    organizationName VARCHAR(150),
    designation VARCHAR(100),

    FOREIGN KEY (userId)
    REFERENCES users(userId)
    ON DELETE CASCADE
);

-- ====================================
-- CAMPUS PLACES
-- ====================================

CREATE TABLE place (
    placeId INT AUTO_INCREMENT PRIMARY KEY,
    placeName VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    icon VARCHAR(100),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- EVENTS
-- ====================================

CREATE TABLE event (
    eventId INT AUTO_INCREMENT PRIMARY KEY,
    organizerId INT NOT NULL,

    title VARCHAR(200) NOT NULL,
    description TEXT,
    eventDate DATE NOT NULL,
    eventTime TIME,
    location VARCHAR(200),
    image VARCHAR(255),

    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (organizerId)
    REFERENCES organizer(organizerId)
    ON DELETE CASCADE
);

-- ====================================
-- EVENT REGISTRATIONS
-- ====================================

CREATE TABLE eventRegistration (
    registrationId INT AUTO_INCREMENT PRIMARY KEY,

    eventId INT NOT NULL,
    studentId INT NOT NULL,

    registeredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (eventId)
    REFERENCES event(eventId)
    ON DELETE CASCADE,

    FOREIGN KEY (studentId)
    REFERENCES student(studentId)
    ON DELETE CASCADE,

    UNIQUE(eventId, studentId)
);

-- ====================================
-- FAVORITE PLACES
-- ====================================

CREATE TABLE favoritePlace (
    favoriteId INT AUTO_INCREMENT PRIMARY KEY,

    studentId INT NOT NULL,
    placeId INT NOT NULL,

    FOREIGN KEY (studentId)
    REFERENCES student(studentId)
    ON DELETE CASCADE,

    FOREIGN KEY (placeId)
    REFERENCES place(placeId)
    ON DELETE CASCADE
);

-- ====================================
-- FAQS
-- ====================================

CREATE TABLE faq (
    faqId INT AUTO_INCREMENT PRIMARY KEY,
    question VARCHAR(255) NOT NULL,
    answer TEXT NOT NULL
);

-- ====================================
-- CONTACT MESSAGES
-- ====================================

CREATE TABLE contactMessage (
    messageId INT AUTO_INCREMENT PRIMARY KEY,
    userName VARCHAR(100),
    email VARCHAR(100),
    subject VARCHAR(200),
    message TEXT NOT NULL,
    submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- NOTIFICATIONS
-- ====================================

CREATE TABLE notification (
    notificationId INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- SAMPLE ADMIN ACCOUNT
-- ====================================

INSERT INTO users
(firstName,lastName,email,password,role)
VALUES
(
'System',
'Admin',
'admin@moraguide.com',
'$2b$10$exampleEncryptedPassword',
'admin'
);

-- ====================================
-- SAMPLE STUDENT ACCOUNT
-- ====================================

INSERT INTO users
(firstName,lastName,email,password,role)
VALUES
(
'Kolitha',
'Sudarshana',
'student@moraguide.com',
'$2b$10$exampleEncryptedPassword',
'student'
);

-- ====================================
-- SAMPLE ORGANIZER ACCOUNT
-- ====================================

INSERT INTO users
(firstName,lastName,email,password,role)
VALUES
(
'Event',
'Manager',
'organizer@moraguide.com',
'$2b$10$exampleEncryptedPassword',
'organizer'
);

-- ====================================
-- SAMPLE PLACES
-- ====================================

INSERT INTO place
(placeName, category, description, latitude, longitude, icon)
VALUES
('Main Gate','Gate',
'University main entrance',
6.79510000,
79.90090000,
'fa-door-open'),

('University Library','Study',
'Main library building',
6.79710000,
79.90150000,
'fa-book-open'),

('Main Canteen','Food',
'Food and beverages',
6.79440000,
79.90270000,
'fa-utensils');

-- ====================================
-- SAMPLE FAQ
-- ====================================

INSERT INTO faq(question,answer)
VALUES
(
'Where is the library?',
'Use the campus map to locate the University Library.'
);

-- ====================================
-- SAMPLE NOTIFICATION
-- ====================================

INSERT INTO notification(title,description)
VALUES
(
'Welcome to MoraGuide',
'Explore campus locations and events easily.'
);

