package com.hrs;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.LocalDate;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:hrs;MODE=MySQL", "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop"})
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
@Transactional
class ReservationTest {

    @Autowired
    org.springframework.test.web.servlet.MockMvc http;
    @Autowired
    Api api;
    @Autowired
    Units units;
    @Autowired
    Vouchers vouchers;

    String account(String email, String role) {
        return (String) api.register(new Api.Auth("Test User", email, "password123", role)).get("token");
    }

    @Test
    void bookingPricesAvailabilityAndOwnership() {
        String owner = account("owner@test.com", "OWNER"), customer = account("guest@test.com", "CUSTOMER");
        Property p = api.create(owner, new Api.Listing("Test Hotel", "HOTEL", "Manila", "", BigDecimal.valueOf(1000), 1, 1, 1));
        Unit room = units.findByPropertyId(p.id).get(0);
        LocalDate start = LocalDate.of(2026, 10, 15);
        Api.Booking b = new Api.Booking(room.id, start, start.plusDays(4), "Guest", "STAY4_GET1");
        var q = api.quote(b);
        assertEquals(new BigDecimal("4000.00"), q.get("originalPrice"));
        assertEquals(new BigDecimal("3000.00"), q.get("finalPrice"));
        Reservation r = api.book(customer, b);
        assertFalse(api.available(room.id, start, start.plusDays(1)));
        assertTrue(api.available(room.id, start.plusDays(4), start.plusDays(5)));
        assertThrows(ResponseStatusException.class, () -> api.book(customer, b));
        assertThrows(ResponseStatusException.class, () -> api.edit(customerId(p), customer, new Api.Listing("No", "HOTEL", null, null, null, 0, 0, 0)));
        api.cancel(r.id, customer);
        assertTrue(api.available(room.id, start, start.plusDays(4)));
    }

    @Test
    void restAuthenticationAndSerialization() throws Exception {
        http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/auth/register").contentType("application/json").content("{\"name\":\"Web Guest\",\"email\":\"rest@test.com\",\"password\":\"password123\",\"role\":\"CUSTOMER\"}"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.token").isString())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.user.password").doesNotExist());
        http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/reservations"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
    }

    Long customerId(Property p) {
        return p.id;
    }

    @Test
    void wholePropertiesAndDateRules() {
        String owner = account("homeowner@test.com", "OWNER");
        Property p = api.create(owner, new Api.Listing("Test Condo", "CONDO", "Quezon City", "", BigDecimal.valueOf(1299), 0, 0, 0));
        assertEquals(1, units.findByPropertyId(p.id).size());
        Unit u = units.findByPropertyId(p.id).get(0);
        LocalDate s = LocalDate.of(2026, 10, 14);
        assertThrows(ResponseStatusException.class, () -> api.quote(new Api.Booking(u.id, s, s.plusDays(1), "Guest", "PAYDAY")));
        assertEquals(new BigDecimal("1208.07"), api.quote(new Api.Booking(u.id, s.plusDays(1), s.plusDays(2), "Guest", "PAYDAY")).get("finalPrice"));
        assertThrows(ResponseStatusException.class, () -> api.addUnits(p.id, owner, new Api.RoomCounts(1, 0, 0)));
        DailyRate rate = new DailyRate();
        rate.date = s;
        rate.percent = BigDecimal.valueOf(150);
        api.rate(p.id, owner, rate);
        assertEquals(new BigDecimal("1948.50"), api.quote(new Api.Booking(u.id, s, s.plusDays(1), "Guest", "")).get("finalPrice"));
    }

    @Test
    void defaultsProtectedAndCredentialsChecked() {
        String owner = account("auth@test.com", "OWNER");
        assertThrows(ResponseStatusException.class, () -> api.login(new Api.Auth(null, "auth@test.com", "wrong", null)));
        Property p = api.create(owner, new Api.Listing("House", "HOUSE", "Pasig", "", BigDecimal.valueOf(500), 0, 0, 0));
        assertThrows(ResponseStatusException.class, () -> api.deleteVoucher(vouchers.findByPropertyId(p.id).get(0).id, owner));
        assertThrows(ResponseStatusException.class, () -> api.register(new Api.Auth("Duplicate", "auth@test.com", "password123", "OWNER")));
    }
}
