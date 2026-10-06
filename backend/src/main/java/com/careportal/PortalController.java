package com.careportal;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.text.Normalizer;

@RestController
@RequestMapping("/api")
public class PortalController {

    final Users users;
    final Sessions sessions;
    final Assignments assignments;
    final Appointments appointments;
    final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    @Value("${care.lab-slots}")
    int labSlots;
    @Value("${care.upload-dir}")
    String uploadDir;
    static final Map<String, List<String>> SPECIALTIES = Map.of("ASSISTANT", List.of(), "LAB", List.of("Radiology", "Blood Chemistry", "CT Scan", "Ultrasound", "Urinalysis"), "SPECIALIZED", List.of("General Medicine", "Pediatrics", "Dentistry", "Psychiatry"));

    PortalController(Users u, Sessions s, Assignments a, Appointments p) {
        users = u;
        sessions = s;
        assignments = a;
        appointments = p;
    }

    record Registration(String firstName, String lastName, String middleName, String password, String role, String staffType, String specialty) {
    }

    record Login(String username, String password, String role) {
    }

    record Booking(Long staffId, LocalDate date, String time) {
    }

    ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }

    void require(boolean condition, String message) {
        if (!condition) {
            throw error(HttpStatus.BAD_REQUEST, message);
    
        }}

    User auth(String header) {
        if (header == null || !header.startsWith("Bearer ")) {
            throw error(HttpStatus.UNAUTHORIZED, "Please log in.");
        
        }var s = sessions.findById(header.substring(7)).orElseThrow(() -> error(HttpStatus.UNAUTHORIZED, "Session expired."));
        if (s.expiresAt.isBefore(Instant.now())) {
            throw error(HttpStatus.UNAUTHORIZED, "Session expired.");
        
        }return users.findById(s.userId).orElseThrow();
    }

    Map<String, Object> publicUser(User u) {
        var m = new LinkedHashMap<String, Object>();
        m.put("id", u.id);
        m.put("username", u.username);
        m.put("name", u.name());
        m.put("role", u.role);
        m.put("staffType", u.staffType);
        m.put("specialty", u.specialty);
        return m;
    }

    String slug(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    @GetMapping("/catalog")
    Object catalog() {
        return Map.of("specialties", SPECIALTIES, "labDailySlots", labSlots, "slotMinutes", 15);
    }

    @PostMapping("/auth/register")
    @Transactional
    Object register(@RequestBody Registration r) {
        require(Set.of("STAFF", "PATIENT").contains(Objects.toString(r.role(), "")), "Choose staff or patient.");
        require(r.firstName() != null && !r.firstName().isBlank() && r.lastName() != null && !r.lastName().isBlank(), "First and last name are required.");
        require(r.password() != null && r.password().length() >= 8 && r.password().length() <= 72, "Password must contain 8–72 characters.");
        if (r.role().equals("STAFF")) {
            require(SPECIALTIES.containsKey(Objects.toString(r.staffType(), "")), "Choose a staff type.");
            if (!r.staffType().equals("ASSISTANT")) {
                require(SPECIALTIES.get(r.staffType()).contains(r.specialty()), "Choose a valid specialty.");
        
            }}
        var u = new User();
        u.firstName = r.firstName().trim();
        u.lastName = r.lastName().trim();
        u.middleName = Objects.toString(r.middleName(), "").trim();
        u.role = r.role();
        u.staffType = u.role.equals("STAFF") ? r.staffType() : null;
        u.specialty = "ASSISTANT".equals(u.staffType) ? null : u.role.equals("STAFF") ? r.specialty() : null;
        u.passwordHash = passwords.encode(r.password());
        users.saveAndFlush(u);
        u.username = slug(u.lastName) + "_" + slug(u.firstName) + "_" + (u.role.equals("PATIENT") ? "P" : "") + String.format("%03d", u.id);
        users.save(u);
        return publicUser(u);
    }

    @PostMapping("/auth/login")
    Object login(@RequestBody Login r) {
        var u = users.findByUsername(Objects.toString(r.username(), "")).orElseThrow(() -> error(HttpStatus.UNAUTHORIZED, "Invalid credentials or account type."));
        if (!Objects.equals(u.role, r.role()) || r.password() == null || !passwords.matches(r.password(), u.passwordHash)) {
            throw error(HttpStatus.UNAUTHORIZED, "Invalid credentials or account type.");
        
        }var s = new LoginSession();
        s.token = UUID.randomUUID().toString() + UUID.randomUUID();
        s.userId = u.id;
        s.expiresAt = Instant.now().plus(Duration.ofHours(12));
        sessions.save(s);
        return Map.of("token", s.token, "user", publicUser(u));
    }

    @PostMapping("/auth/logout")
    Object logout(@RequestHeader(value = "Authorization", required = false) String h) {
        auth(h);
        sessions.deleteById(h.substring(7));
        return Map.of("message", "Logged out");
    }

    @GetMapping("/me")
    Object me(@RequestHeader(value = "Authorization", required = false) String h) {
        return publicUser(auth(h));
    }

    @GetMapping("/staff")
    Object staff(@RequestHeader(value = "Authorization", required = false) String h) {
        auth(h);
        return users.findAll().stream().filter(u -> "STAFF".equals(u.role) && !"ASSISTANT".equals(u.staffType)).map(this::publicUser).toList();
    }

    @GetMapping("/assignments")
    Object assigned(@RequestHeader(value = "Authorization", required = false) String h) {
        var u = auth(h);
        return assignments.findByAssistantId(u.id).stream().map(a -> a.doctorId).toList();
    }

    @PostMapping("/assignments/{doctorId}")
    @Transactional
    Object assign(@RequestHeader(value = "Authorization", required = false) String h, @PathVariable Long doctorId) {
        var u = auth(h);
        if (!"ASSISTANT".equals(u.staffType)) {
            throw error(HttpStatus.FORBIDDEN, "Assistant access required.");
        
        }var d = users.findById(doctorId).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Doctor not found."));
        require("SPECIALIZED".equals(d.staffType), "Choose a practitioner.");
        users.lockById(u.id);
        if (assignments.findByAssistantId(u.id).stream().noneMatch(a -> a.doctorId.equals(doctorId))) {
            var a = new Assignment();
            a.assistantId = u.id;
            a.doctorId = doctorId;
            assignments.save(a);
        }
        return Map.of("message", "Doctor assigned");
    }

    @DeleteMapping("/assignments/{doctorId}")
    @Transactional
    Object unassign(@RequestHeader(value = "Authorization", required = false) String h, @PathVariable Long doctorId) {
        var u = auth(h);
        if (!"ASSISTANT".equals(u.staffType)) {
            throw error(HttpStatus.FORBIDDEN, "Assistant access required.");
        
        }assignments.deleteByAssistantIdAndDoctorId(u.id, doctorId);
        return Map.of("message", "Assignment removed");
    }

    List<LocalDateTime> slots(User staff, LocalDate date) {
        require(date != null && !date.isBefore(LocalDate.now()), "Choose today or a future date.");
        if ("LAB".equals(staff.staffType)) {
            long count = appointments.findAll().stream().filter(a -> a.startsAt.toLocalDate().equals(date)).filter(a -> users.findById(a.staffId).map(x -> "LAB".equals(x.staffType) && Objects.equals(x.specialty, staff.specialty)).orElse(false)).count();
            if (count >= labSlots) {
                return List.of();
        
            }}
        int n = "LAB".equals(staff.staffType) ? labSlots : 24;
        var booked = appointments.findByStaffId(staff.id).stream().map(a -> a.startsAt).toList();
        return java.util.stream.IntStream.range(0, n).mapToObj(i -> date.atTime(8, 0).plusMinutes(15L * i)).filter(t -> t.isAfter(LocalDateTime.now()) && !booked.contains(t)).toList();
    }

    @GetMapping("/availability")
    Object available(@RequestHeader(value = "Authorization", required = false) String h, @RequestParam Long staffId, @RequestParam LocalDate date) {
        auth(h);
        var s = users.findById(staffId).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Staff not found."));
        require(s.staffType != null && !s.staffType.equals("ASSISTANT"), "Select a doctor or lab staff member.");
        return slots(s, date);
    }

    @PostMapping("/appointments")
    @Transactional
    Object book(@RequestHeader(value = "Authorization", required = false) String h, @RequestBody Booking b) {
        var u = auth(h);
        if (!"PATIENT".equals(u.role)) {
            throw error(HttpStatus.FORBIDDEN, "Only patients can book.");
        
        }users.lockById(u.id);
        var selected = users.findById(b.staffId()).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Staff not found."));
        if ("LAB".equals(selected.staffType)) {
            users.lockLaboratory(selected.specialty);
        
        }var s = users.lockById(b.staffId()).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Staff not found."));
        require(s.staffType != null && !s.staffType.equals("ASSISTANT"), "Choose a practitioner or laboratory staff member.");
        LocalDateTime t;
        try {
            t = b.date().atTime(LocalTime.parse(b.time()));
        } catch (Exception e) {
            throw error(HttpStatus.BAD_REQUEST, "Choose a valid date and time.");
        }
        require(slots(s, b.date()).contains(t), "This slot is no longer available.");
        if ("LAB".equals(s.staffType)) {
            long count = appointments.findAll().stream().filter(a -> a.startsAt.toLocalDate().equals(b.date())).filter(a -> users.findById(a.staffId).map(x -> "LAB".equals(x.staffType) && Objects.equals(x.specialty, s.specialty)).orElse(false)).count();
            require(count < labSlots, "This laboratory is fully booked for the day.");
        }
        require(appointments.findAll().stream().noneMatch(a -> a.patientId.equals(u.id) && a.startsAt.equals(t)), "You already have an appointment at this time.");
        var a = new Appointment();
        a.staffId = s.id;
        a.patientId = u.id;
        a.startsAt = t;
        appointments.save(a);
        return view(a);
    }

    boolean canManage(User u, Appointment a) {
        return Objects.equals(u.id, a.staffId) || "ASSISTANT".equals(u.staffType) && assignments.findByAssistantId(u.id).stream().anyMatch(x -> x.doctorId.equals(a.staffId));
    }

    boolean canSee(User u, Appointment a) {
        return Objects.equals(u.id, a.patientId) || canManage(u, a);
    }

    Map<String, Object> view(Appointment a) {
        var m = new LinkedHashMap<String, Object>();
        m.put("id", a.id);
        m.put("startsAt", a.startsAt);
        m.put("status", a.status);
        m.put("comments", a.comments);
        m.put("staff", publicUser(users.findById(a.staffId).orElseThrow()));
        m.put("patient", publicUser(users.findById(a.patientId).orElseThrow()));
        m.put("fileName", a.fileName);
        return m;
    }

    @GetMapping("/appointments")
    Object list(@RequestHeader(value = "Authorization", required = false) String h) {
        var u = auth(h);
        return appointments.findAll().stream().filter(a -> canSee(u, a)).sorted(Comparator.comparing(a -> a.startsAt)).map(this::view).toList();
    }

    @PostMapping("/appointments/{id}/results")
    Object result(@RequestHeader(value = "Authorization", required = false) String h, @PathVariable Long id, @RequestParam String status, @RequestParam(defaultValue = "") String comments, @RequestParam(required = false) MultipartFile file) throws Exception {
        var u = auth(h);
        var a = appointments.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Appointment not found."));
        if (!canManage(u, a)) {
            throw error(HttpStatus.FORBIDDEN, "This appointment is not assigned to you.");
        
        }require(Set.of("DONE", "FOLLOW_UP").contains(status), "Choose done or follow up.");
        require(comments.length() <= 4000, "Comments must be at most 4000 characters.");
        if (file != null && !file.isEmpty()) {
            if ("ASSISTANT".equals(u.staffType)) {
                throw error(HttpStatus.FORBIDDEN, "Only assigned practitioners and lab staff can upload results.");
            
            }require(Set.of("application/pdf", "image/png", "image/jpeg", "text/plain").contains(Objects.toString(file.getContentType(), "")), "Upload a PDF, PNG, JPEG, or text file.");
            Files.createDirectories(Path.of(uploadDir));
            a.fileKey = UUID.randomUUID().toString();
            a.fileName = Path.of(Objects.toString(file.getOriginalFilename(), "result")).getFileName().toString();
            a.fileType = file.getContentType();
            Files.copy(file.getInputStream(), Path.of(uploadDir, a.fileKey));
        }
        a.status = status;
        a.comments = comments;
        appointments.save(a);
        return view(a);
    }

    @GetMapping("/appointments/{id}/file")
    ResponseEntity<byte[]> download(@RequestHeader(value = "Authorization", required = false) String h, @PathVariable Long id) throws Exception {
        var u = auth(h);
        var a = appointments.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Appointment not found."));
        if (!canSee(u, a)) {
            throw error(HttpStatus.FORBIDDEN, "Access denied.");
        
        }if (a.fileKey == null) {
            throw error(HttpStatus.NOT_FOUND, "No result uploaded.");
        
        }return ResponseEntity.ok().contentType(MediaType.parseMediaType(a.fileType)).header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(a.fileName, java.nio.charset.StandardCharsets.UTF_8).build().toString()).body(Files.readAllBytes(Path.of(uploadDir, a.fileKey)));
    }
}
