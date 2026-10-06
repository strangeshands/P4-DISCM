package com.hrs;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.LocalDate;

interface Accounts extends JpaRepository<Account, Long> {

    Optional<Account> findByEmail(String email);
}

interface Sessions extends JpaRepository<LoginSession, String> {
}

interface Properties extends JpaRepository<Property, Long> {
}

interface Units extends JpaRepository<Unit, Long> {

    List<Unit> findByPropertyId(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Unit u where u.id = :id")
    Optional<Unit> lock(@Param("id") Long id);
}

interface Vouchers extends JpaRepository<Voucher, Long> {

    List<Voucher> findByPropertyId(Long id);

    Optional<Voucher> findByPropertyIdAndCode(Long id, String code);
}

interface Rates extends JpaRepository<DailyRate, Long> {

    List<DailyRate> findByPropertyId(Long id);

    Optional<DailyRate> findByPropertyIdAndDate(Long id, LocalDate date);
}

interface Reservations extends JpaRepository<Reservation, Long> {

    List<Reservation> findByPropertyId(Long id);

    List<Reservation> findByCustomerId(Long id);

    boolean existsByUnitIdAndStatusAndCheckInLessThanAndCheckOutGreaterThan(Long id, String status, LocalDate end, LocalDate start);

    boolean existsByUnitIdAndStatus(Long id, String status);

    boolean existsByPropertyIdAndStatus(Long id, String status);
}
