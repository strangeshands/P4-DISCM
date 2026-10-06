package com.hrs;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api")
@Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
public class Api {

    final Accounts accounts;
    final Sessions sessions;
    final Properties properties;
    final Units units;
    final Vouchers vouchers;
    final Rates rates;
    final Reservations reservations;
    final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    Api(Accounts a, Sessions s, Properties p, Units u, Vouchers v, Rates d, Reservations r) {
        accounts = a;
        sessions = s;
        properties = p;
        units = u;
        vouchers = v;
        rates = d;
        reservations = r;
    }

    static void require(boolean ok, String message) {
        if (!ok) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    
        }}

    static String text(String s) {
        require(s != null && !s.isBlank(), "Please complete all required fields.");
        return s.trim();
    }

    Account user(String token) {
        LoginSession s = sessions.findById(token == null ? "" : token).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in."));
        if (s.expires.isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session expired.");
        
        }return accounts.findById(s.accountId).orElseThrow();
    }

    Property property(Long id) {
        return properties.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found."));
    }

    Property owner(Long id, String token) {
        Property p = property(id);
        if (!p.ownerId.equals(user(token).id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the property owner can manage this listing.");
        
        }return p;
    }

    record Auth(String name, String email, String password, String role) {
    }

    Map<String, Object> session(Account a) {
        LoginSession s = new LoginSession();
        s.token = UUID.randomUUID().toString();
        s.accountId = a.id;
        s.expires = Instant.now().plus(Duration.ofDays(7));
        sessions.save(s);
        return Map.of("token", s.token, "user", a);
    }

    @PostMapping("/auth/register")
    Map<String, Object> register(@RequestBody Auth b) {
        String email = text(b.email()).toLowerCase(Locale.ROOT);
        require(email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"), "Enter a valid email.");
        require(accounts.findByEmail(email).isEmpty(), "Email already registered.");
        require(b.password() != null && b.password().length() >= 8 && b.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 72, "Password must have at least 8 characters and at most 72 bytes.");
        require(b.role() != null && Set.of("CUSTOMER", "OWNER").contains(b.role()), "Select an account type.");
        Account a = new Account();
        a.name = text(b.name());
        a.email = email;
        a.role = b.role();
        a.password = passwords.encode(b.password());
        return session(accounts.save(a));
    }

    @PostMapping("/auth/login")
    Map<String, Object> login(@RequestBody Auth b) {
        Account a = accounts.findByEmail(text(b.email()).toLowerCase(Locale.ROOT)).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password."));
        if (b.password() == null || !passwords.matches(b.password(), a.password)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
        
        }return session(a);
    }

    @GetMapping("/auth/me")
    Account me(@RequestHeader(value = "X-Session", required = false) String t) {
        return user(t);
    }

    @PostMapping("/auth/logout")
    void logout(@RequestHeader("X-Session") String t) {
        sessions.deleteById(t);
    }

    @GetMapping("/properties")
    List<Property> list() {
        return properties.findAll();
    }

    record Listing(String name, String type, String location, String description, BigDecimal basePrice, int standard, int deluxe, int executive) {
    }

    @PostMapping("/properties")
    Property create(@RequestHeader("X-Session") String t, @RequestBody Listing b) {
        Account a = user(t);
        require(a.role.equals("OWNER"), "Register as a property owner to list a property.");
        require(b.type() != null && Set.of("HOTEL", "HOUSE", "CONDO").contains(b.type()), "Invalid property type.");
        require(b.basePrice() != null && b.basePrice().compareTo(new BigDecimal("100")) >= 0, "Minimum base price is 100.");
        String name = text(b.name());
        require(properties.findAll().stream().noneMatch(p -> p.name.equalsIgnoreCase(name)), "Property name already exists.");
        Property p = new Property();
        p.ownerId = a.id;
        p.name = name;
        p.type = b.type();
        p.location = text(b.location());
        p.description = b.description();
        p.basePrice = b.basePrice();
        if (p.type.equals("HOTEL")) {
            require(b.standard() >= 0 && b.deluxe() >= 0 && b.executive() >= 0 && b.standard() + b.deluxe() + b.executive() >= 1 && b.standard() + b.deluxe() + b.executive() <= 50, "Hotels must have 1–50 rooms.");
        
        }properties.save(p);
        if (p.type.equals("HOTEL")) {
            add(p, b.standard(), b.deluxe(), b.executive()); 
        }else {
            Unit u = new Unit();
            u.propertyId = p.id;
            u.name = "Entire property";
            u.type = "STANDARD";
            units.save(u);
        }
        builtin(p.id, "I_WORK_HERE", "DISCOUNT", 10, 0, 0, 0, 0);
        builtin(p.id, "PAYDAY", "DATE", 7, 15, 30, 0, 0);
        builtin(p.id, "STAY4_GET1", "STAY", 100, 0, 0, 4, 1);
        return p;
    }

    void builtin(Long id, String code, String type, int percent, int d1, int d2, int nights, int night) {
        Voucher v = new Voucher();
        v.propertyId = id;
        v.code = code;
        v.type = type;
        v.percent = BigDecimal.valueOf(percent);
        v.date1 = d1;
        v.date2 = d2;
        v.minNights = nights;
        v.discountedNight = night;
        v.builtIn = true;
        vouchers.save(v);
    }

    void add(Property p, int s, int d, int e) {
        Set<String> names = new HashSet<>();
        units.findByPropertyId(p.id).forEach(u -> names.add(u.name));
        for (String type : List.of("STANDARD", "DELUXE", "EXECUTIVE")) {
            int count = type.equals("STANDARD") ? s : type.equals("DELUXE") ? d : e;
            for (int i = 0; i < count; i++) {
                int n = 0;
                String name;
                do {
                    n++;
                    name = String.valueOf(100 * ((n - 1) / 10 + 1) + (n - 1) % 10 + 1);
                } while (names.contains(name));
                names.add(name);
                Unit u = new Unit();
                u.propertyId = p.id;
                u.name = name;
                u.type = type;
                units.save(u);
            }
        }
    }

    @PatchMapping("/properties/{id}")
    Property edit(@PathVariable Long id, @RequestHeader("X-Session") String t, @RequestBody Listing b) {
        Property p = owner(id, t);
        if (b.name() != null) {
            String name = text(b.name());
            require(properties.findAll().stream().noneMatch(x -> !x.id.equals(id) && x.name.equalsIgnoreCase(name)), "Name already exists.");
            p.name = name;
        }
        if (b.basePrice() != null && !b.basePrice().equals(p.basePrice)) {
            require(!reservations.existsByPropertyIdAndStatus(id, "RESERVED"), "Cancel active reservations before changing base price.");
            require(b.basePrice().compareTo(new BigDecimal("100")) >= 0, "Minimum base price is 100.");
            p.basePrice = b.basePrice();
        }
        if (b.location() != null) {
            p.location = text(b.location());
        
        }if (b.description() != null) {
            p.description = b.description();
        
        }return properties.save(p);
    }

    @DeleteMapping("/properties/{id}")
    void delete(@PathVariable Long id, @RequestHeader("X-Session") String t) {
        owner(id, t);
        reservations.deleteAll(reservations.findByPropertyId(id));
        units.deleteAll(units.findByPropertyId(id));
        vouchers.deleteAll(vouchers.findByPropertyId(id));
        rates.deleteAll(rates.findByPropertyId(id));
        properties.deleteById(id);
    }

    record RoomCounts(int standard, int deluxe, int executive) {
    }

    @PostMapping("/properties/{id}/units")
    void addUnits(@PathVariable Long id, @RequestHeader("X-Session") String t, @RequestBody RoomCounts b) {
        Property p = owner(id, t);
        require(p.type.equals("HOTEL"), "Houses and condos are rented as entire properties.");
        require(b.standard() >= 0 && b.deluxe() >= 0 && b.executive() >= 0, "Counts cannot be negative.");
        int n = b.standard() + b.deluxe() + b.executive();
        require(n > 0 && units.findByPropertyId(id).size() + n <= 50, "Add rooms within the 50-room limit.");
        add(p, b.standard(), b.deluxe(), b.executive());
    }

    @DeleteMapping("/units/{id}")
    void removeUnit(@PathVariable Long id, @RequestHeader("X-Session") String t) {
        Unit u = units.lock(id).orElseThrow();
        Property p = owner(u.propertyId, t);
        require(p.type.equals("HOTEL") && units.findByPropertyId(p.id).size() > 1, "Keep at least one room.");
        require(!reservations.existsByUnitIdAndStatus(id, "RESERVED"), "A reserved room cannot be removed.");
        units.delete(u);
    }

    record Removal(Long firstId, Long lastId) {
    }

    @PostMapping("/properties/{id}/units/remove-range")
    void removeRange(@PathVariable Long id, @RequestHeader("X-Session") String t, @RequestBody Removal b) {
        Property p = owner(id, t);
        require(p.type.equals("HOTEL"), "Only hotels have multiple rooms.");
        List<Unit> list = units.findByPropertyId(id).stream().sorted(Comparator.comparing(u -> u.name)).toList();
        int first = -1, last = -1;
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).id.equals(b.firstId())) {
                first = i;
            
            }if (list.get(i).id.equals(b.lastId())) {
                last = i;
        
            }}
        require(first >= 0 && last >= first, "Choose a valid room range.");
        require(list.size() - (last - first + 1) >= 1, "Keep at least one room.");
        List<Unit> removed = new ArrayList<>();
        for (int i = first; i <= last; i++) {
            Unit u = units.lock(list.get(i).id).orElseThrow();
            require(!reservations.existsByUnitIdAndStatus(u.id, "RESERVED"), "A reserved room cannot be removed.");
            removed.add(u);
        }
        units.deleteAll(removed);
    }

    @GetMapping("/properties/{id}/details")
    Map<String, Object> details(@PathVariable Long id) {
        Property p = property(id);
        BigDecimal earnings = reservations.findByPropertyId(id).stream().filter(r -> r.status.equals("RESERVED")).map(r -> r.finalPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
        return Map.of("property", p, "units", units.findByPropertyId(id), "vouchers", vouchers.findByPropertyId(id), "rates", rates.findByPropertyId(id), "earnings", earnings);
    }

    @GetMapping("/properties/{id}/availability")
    List<Map<String, Object>> availability(@PathVariable Long id, @RequestParam LocalDate start, @RequestParam LocalDate end) {
        dates(start, end);
        return units.findByPropertyId(id).stream().map(u -> Map.<String, Object>of("unit", u, "available", available(u.id, start, end))).toList();
    }

    boolean available(Long id, LocalDate start, LocalDate end) {
        return !reservations.existsByUnitIdAndStatusAndCheckInLessThanAndCheckOutGreaterThan(id, "RESERVED", end, start);
    }

    static void dates(LocalDate s, LocalDate e) {
        require(s != null && e != null && e.isAfter(s) && ChronoUnit.DAYS.between(s, e) <= 365, "Choose a valid stay of 1–365 nights.");
    }

    @PutMapping("/properties/{id}/rates")
    DailyRate rate(@PathVariable Long id, @RequestHeader("X-Session") String t, @RequestBody DailyRate b) {
        owner(id, t);
        require(b.date != null && b.percent != null && b.percent.compareTo(BigDecimal.valueOf(50)) >= 0 && b.percent.compareTo(BigDecimal.valueOf(150)) <= 0, "Rate must be 50–150%.");
        DailyRate r = rates.findByPropertyIdAndDate(id, b.date).orElse(new DailyRate());
        r.propertyId = id;
        r.date = b.date;
        r.percent = b.percent;
        return rates.save(r);
    }

    @PostMapping("/properties/{id}/vouchers")
    Voucher voucher(@PathVariable Long id, @RequestHeader("X-Session") String t, @RequestBody Voucher v) {
        owner(id, t);
        v.id = null;
        v.propertyId = id;
        v.builtIn = false;
        v.code = text(v.code);
        require(vouchers.findByPropertyIdAndCode(id, v.code).isEmpty(), "Code already exists.");
        require(v.type != null && Set.of("DISCOUNT", "DATE", "STAY").contains(v.type), "Invalid voucher type.");
        require(v.percent != null && v.percent.signum() >= 0 && v.percent.compareTo(BigDecimal.valueOf(100)) <= 0, "Discount must be 0–100%.");
        if (v.type.equals("DATE")) {
            require(v.date1 != null && v.date1 >= 1 && v.date1 <= 31 && v.date2 != null && v.date2 >= 0 && v.date2 <= 31, "Date days must be 1–31; second day may be 0.");
        
        }if (v.type.equals("STAY")) {
            require(v.minNights != null && v.discountedNight != null && v.minNights >= 1 && v.minNights <= 365 && v.discountedNight >= 1 && v.discountedNight <= v.minNights, "Check minimum stay and discounted night.");
        
        }return vouchers.save(v);
    }

    @DeleteMapping("/vouchers/{id}")
    void deleteVoucher(@PathVariable Long id, @RequestHeader("X-Session") String t) {
        Voucher v = vouchers.findById(id).orElseThrow();
        owner(v.propertyId, t);
        require(!v.builtIn, "Default vouchers cannot be deleted.");
        vouchers.delete(v);
    }

    record Booking(Long unitId, LocalDate checkIn, LocalDate checkOut, String guestName, String voucherCode) {
    }

    @PostMapping("/reservations/quote")
    Map<String, Object> quote(@RequestBody Booking b) {
        Unit u = units.findById(b.unitId()).orElseThrow();
        return calculate(u, b);
    }

    Map<String, Object> calculate(Unit u, Booking b) {
        dates(b.checkIn(), b.checkOut());
        require(available(u.id, b.checkIn(), b.checkOut()), "This room or property is unavailable for these dates.");
        Property p = property(u.propertyId);
        BigDecimal multiplier = u.type.equals("DELUXE") ? new BigDecimal("1.20") : u.type.equals("EXECUTIVE") ? new BigDecimal("1.35") : BigDecimal.ONE;
        List<Map<String, Object>> lines = new ArrayList<>();
        List<BigDecimal> prices = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (LocalDate day = b.checkIn(); day.isBefore(b.checkOut()); day = day.plusDays(1)) {
            BigDecimal rate = rates.findByPropertyIdAndDate(p.id, day).map(r -> r.percent).orElse(BigDecimal.valueOf(100));
            BigDecimal price = p.basePrice.multiply(multiplier).multiply(rate).divide(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
            total = total.add(price);
            prices.add(price);
            lines.add(Map.of("date", day, "rate", rate, "price", price));
        }
        BigDecimal discount = BigDecimal.ZERO;
        if (b.voucherCode() != null && !b.voucherCode().isBlank()) {
            Voucher v = vouchers.findByPropertyIdAndCode(p.id, b.voucherCode().trim()).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voucher not found."));
            if (v.type.equals("DATE")) {
                require(lines.stream().anyMatch(l -> {
                    int d = ((LocalDate) l.get("date")).getDayOfMonth();
                    return d == v.date1 || d == v.date2;
                }), "Voucher requires a qualifying occupied date.");
            
            }if (v.type.equals("STAY")) {
                require(prices.size() >= v.minNights, "Voucher requires a longer stay.");
                discount = prices.get(v.discountedNight - 1).multiply(v.percent).divide(BigDecimal.valueOf(100));
            } else {
                discount = total.multiply(v.percent).divide(BigDecimal.valueOf(100));
        
            }}
        discount = discount.setScale(2, RoundingMode.HALF_UP);
        return Map.of("originalPrice", total, "discount", discount, "finalPrice", total.subtract(discount), "nights", lines);
    }

    @PostMapping("/reservations")
    Reservation book(@RequestHeader("X-Session") String t, @RequestBody Booking b) {
        Account a = user(t);
        require(a.role.equals("CUSTOMER"), "Use a customer account to book a stay.");
        Unit u = units.lock(b.unitId()).orElseThrow();
        Map<String, Object> q = calculate(u, b);
        Reservation r = new Reservation();
        r.propertyId = u.propertyId;
        r.unitId = u.id;
        r.customerId = a.id;
        r.guestName = text(b.guestName());
        r.status = "RESERVED";
        r.checkIn = b.checkIn();
        r.checkOut = b.checkOut();
        r.voucherCode = b.voucherCode();
        r.originalPrice = (BigDecimal) q.get("originalPrice");
        r.discount = (BigDecimal) q.get("discount");
        r.finalPrice = (BigDecimal) q.get("finalPrice");
        try {
            r.breakdown = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(q.get("nights"));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        return reservations.save(r);
    }

    @GetMapping("/reservations")
    List<Reservation> bookings(@RequestHeader("X-Session") String t, @RequestParam(required = false) Long propertyId) {
        Account a = user(t);
        if (propertyId != null) {
            owner(propertyId, t);
            return reservations.findByPropertyId(propertyId);
        }
        return reservations.findByCustomerId(a.id);
    }

    @DeleteMapping("/reservations/{id}")
    void cancel(@PathVariable Long id, @RequestHeader("X-Session") String t) {
        Account a = user(t);
        Reservation r = reservations.findById(id).orElseThrow();
        units.lock(r.unitId);
        require(a.id.equals(r.customerId) || a.id.equals(property(r.propertyId).ownerId), "You cannot cancel this reservation.");
        r.status = "CANCELLED";
        reservations.save(r);
    }
}
