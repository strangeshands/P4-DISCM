package com.hrs;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

class Models {
}

@Entity
@Table(name = "accounts")
class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @Column(unique = true, nullable = false)
    public String email;
    public String name, role;
    @JsonIgnore
    public String password;
}

@Entity
class LoginSession {

    @Id
    public String token;
    public Long accountId;
    public Instant expires;
}

@Entity
@Table(name = "properties")
class Property {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long ownerId;
    public String name, type, location;
    @Column(length = 2000)
    public String description;
    public BigDecimal basePrice;
}

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"propertyId", "name"}))
class Unit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long propertyId;
    public String name, type;
}

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"propertyId", "code"}))
class Voucher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long propertyId;
    public String code, type;
    public BigDecimal percent;
    public Integer date1, date2, minNights, discountedNight;
    public boolean builtIn;
}

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"propertyId", "date"}))
class DailyRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long propertyId;
    public LocalDate date;
    public BigDecimal percent;
}

@Entity
class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long propertyId, unitId, customerId;
    public String guestName, status, voucherCode;
    public LocalDate checkIn, checkOut;
    public BigDecimal originalPrice, discount, finalPrice;
    @Lob
    public String breakdown;
}
