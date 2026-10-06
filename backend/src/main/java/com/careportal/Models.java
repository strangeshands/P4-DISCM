package com.careportal;

import jakarta.persistence.*;
import java.time.*;

class Models {
}

@Entity
@Table(name = "portal_users")
class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @Column(unique = true)
    public String username;
    public String firstName, lastName, middleName, role, staffType, specialty;
    public String passwordHash;

    public String name() {
        return firstName + " " + (middleName == null || middleName.isBlank() ? "" : middleName + " ") + lastName;
    }
}

@Entity
class LoginSession {

    @Id
    public String token;
    public Long userId;
    public Instant expiresAt;
}

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"assistantId", "doctorId"}))
class Assignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long assistantId, doctorId;
}

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"staffId", "startsAt"}))
class Appointment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long patientId, staffId;
    public LocalDateTime startsAt;
    public String status = "BOOKED";
    @Column(length = 4000)
    public String comments = "";
    public String fileKey, fileName, fileType;
}
