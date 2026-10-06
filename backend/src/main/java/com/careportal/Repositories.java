package com.careportal;

import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
import java.util.*;

interface Users extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> lockById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.staffType = 'LAB' and u.specialty = :specialty order by u.id")
    List<User> lockLaboratory(String specialty);
}

interface Sessions extends JpaRepository<LoginSession, String> {
}

interface Assignments extends JpaRepository<Assignment, Long> {

    List<Assignment> findByAssistantId(Long id);

    void deleteByAssistantIdAndDoctorId(Long a, Long d);
}

interface Appointments extends JpaRepository<Appointment, Long> {

    List<Appointment> findByStaffId(Long id);
}
