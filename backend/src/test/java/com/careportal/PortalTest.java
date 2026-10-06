package com.careportal;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.mock.web.MockMultipartFile;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:test;DB_CLOSE_DELAY=-1", "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=", "care.upload-dir=/tmp/care-test-uploads"})
@Transactional
class PortalTest {

    @Autowired
    PortalController api;
    @Autowired
    Users users;

    User register(String first, String role, String type, String specialty) {
        var result = (Map<?, ?>) api.register(new PortalController.Registration(first, "Dela Cruz", "", "password123", role, type, specialty));
        return users.findById((Long) result.get("id")).orElseThrow();
    }

    String login(User u) {
        return "Bearer " + ((Map<?, ?>) api.login(new PortalController.Login(u.username, "password123", u.role))).get("token");
    }

    @Test
    void registrationAndRevokedLogin() {
        User p = register("Juan", "PATIENT", null, null);
        assertTrue(p.username.matches("delacruz_juan_P[0-9]+"));
        assertNotEquals("password123", p.passwordHash);
        String h = login(p);
        assertNotNull(api.me(h));
        api.logout(h);
        assertThrows(ResponseStatusException.class, () -> api.me(h));
        assertThrows(ResponseStatusException.class, () -> api.login(new PortalController.Login(p.username, "password123", "STAFF")));
    }

    @Test
    void bookingOwnershipAssignmentsAndResults() throws Exception {
        User d = register("Doctor", "STAFF", "SPECIALIZED", "General Medicine"), p = register("Patient", "PATIENT", null, null), other = register("Other", "PATIENT", null, null), a = register("Assistant", "STAFF", "ASSISTANT", null);
        String dh = login(d), ph = login(p), ah = login(a);
        var b = new PortalController.Booking(d.id, LocalDate.now().plusDays(1), "08:00");
        var booked = (Map<?, ?>) api.book(ph, b);
        Long id = (Long) booked.get("id");
        assertThrows(ResponseStatusException.class, () -> api.book(login(other), b));
        assertTrue(((List<?>) api.list(ah)).isEmpty());
        api.assign(ah, d.id);
        assertEquals(1, ((List<?>) api.list(ah)).size());
        assertThrows(ResponseStatusException.class, () -> api.result(login(other), id, "DONE", "no", null));
        assertThrows(ResponseStatusException.class, () -> api.result(ah, id, "DONE", "no", new MockMultipartFile("file", "result.txt", "text/plain", "test".getBytes())));
        api.result(dh, id, "FOLLOW_UP", "Review in two weeks", new MockMultipartFile("file", "result.txt", "text/plain", "test".getBytes()));
        assertArrayEquals("test".getBytes(), api.download(ph, id).getBody());
        assertThrows(ResponseStatusException.class, () -> api.download(login(other), id));
        api.unassign(ah, d.id);
        assertTrue(((List<?>) api.list(ah)).isEmpty());
    }

    @Test
    void labCapacitySharedAcrossStaff() {
        User l1 = register("LabOne", "STAFF", "LAB", "Radiology"), l2 = register("LabTwo", "STAFF", "LAB", "Radiology"), p = register("Patient", "PATIENT", null, null);
        String h = login(p);
        LocalDate date = LocalDate.now().plusDays(2);
        for (int i = 0; i < 25; i++) {
            api.book(h, new PortalController.Booking(l1.id, date, LocalTime.of(8, 0).plusMinutes(15L * i).toString()));
        
        }assertTrue(((List<?>) api.available(h, l2.id, date)).isEmpty());
        assertThrows(ResponseStatusException.class, () -> api.book(h, new PortalController.Booking(l2.id, date, "08:00")));
    }

    @Test
    void rejectsInvalidSpecialty() {
        assertThrows(ResponseStatusException.class, () -> register("Bad", "STAFF", "LAB", "Dentistry"));
    }
}
