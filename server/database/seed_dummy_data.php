<?php
/**
 * Realistic Dummy Data Seeder for IMP Database
 * Generates rich test data across all 4 modules:
 * - Users, Profiles, Bank Accounts, Addresses, References
 * - Clients (Normal & Admin)
 * - Projects (50+ records with links, notes, team members, custom meta)
 * - AG Grid Enterprise Ready
 */

require_once __DIR__ . '/../core/App.php';
\Core\App::bootstrap(dirname(__DIR__));

use Core\Database;
use Core\Auth;

echo "Seeding rich dummy data into database 'imp'...\n";

Database::beginTransaction();

try {
    // ----------------------------------------------------
    // 1. SEED CLIENTS
    // ----------------------------------------------------
    $clientsData = [
        ['Apex Commercial Builders', 'Apex Group USA', 'normal', 'contact@apexbuilders.com', '+1 (555) 234-5678', '1200 Avenue of the Americas, New York, NY', 'Premier commercial construction partner.'],
        ['Summit Peak Contracting', 'Summit Enterprises', 'normal', 'bids@summitpeak.com', '+1 (555) 876-5432', '450 Market Street, San Francisco, CA', 'High-rise residential and multi-family developers.'],
        ['In-House Operations', 'Internal IMP Division', 'admin', 'operations@imp.internal', '+92 42 35789000', 'Tech Park, Main Boulevard, Gulberg III, Lahore', 'Internal projects and self-bidding tenders.'],
        ['Vanguard Heavy Civil', 'Vanguard Infrastructure', 'normal', 'estimating@vanguardcivil.com', '+1 (555) 432-1098', '789 Industrial Pkwy, Chicago, IL', 'Bridges, roads, and civil infrastructure projects.'],
        ['Horizon Hospitality Group', 'Horizon Hotels Corp', 'normal', 'dev@horizonhg.com', '+1 (555) 901-2345', '100 Ocean Drive, Miami, FL', 'Luxury resort renovations and hotel fitouts.'],
        ['Crestview Retail Partners', 'Crestview Capital', 'normal', 'projects@crestviewretail.com', '+1 (555) 345-6789', '2200 Galleria Mall Way, Houston, TX', 'Shopping mall tenant improvements and retail spaces.'],
        ['Beacon Healthcare Facilities', 'Beacon Health System', 'normal', 'facilities@beaconhealth.org', '+1 (555) 678-9012', '500 Medical Center Blvd, Boston, MA', 'Hospital wing additions and outpatient clinics.'],
        ['Ironclad Industrial Warehousing', 'Ironclad Logistics Inc', 'normal', 'bids@ironcladlogistics.com', '+1 (555) 789-0123', '3300 Distribution Rd, Atlanta, GA', 'Distribution centers and cold storage facilities.'],
        ['Metro Transit Authority', 'City Transit District', 'normal', 'procurement@metrotransit.gov', '+1 (555) 890-1234', '100 City Hall Plaza, Philadelphia, PA', 'Public transit hubs and terminal upgrades.'],
        ['Internal Fast-Track Ventures', 'IMP Strategic Ventures', 'admin', 'ventures@imp.internal', '+92 42 35789001', 'Tech Park, Lahore', 'Internal fast-track estimation and venture projects.']
    ];

    $clientIds = [];
    foreach ($clientsData as $c) {
        $existing = Database::fetch("SELECT id FROM clients WHERE name = :name", ['name' => $c[0]]);
        if ($existing) {
            $clientIds[] = $existing['id'];
        } else {
            $id = Database::insert('clients', [
                'name'         => $c[0],
                'company_name' => $c[1],
                'client_type'  => $c[2],
                'email'        => $c[3],
                'phone'        => $c[4],
                'address'      => $c[5],
                'notes'        => $c[6],
                'status'       => 'active',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ]);
            $clientIds[] = $id;
        }
    }
    echo "  [OK] " . count($clientIds) . " Clients verified/seeded.\n";

    // ----------------------------------------------------
    // 2. SEED USERS ACROSS ROLES
    // ----------------------------------------------------
    $usersData = [
        ['ahmed.khan', 'ahmed.khan@imp.internal', 'Ahmed Khan', 3, 'male', '+92 300 1112233', 'Meezan Bank', 'PK36MEZN0001112233445566', 'Project Manager', 'Lahore'],
        ['bilal.tariq', 'bilal.tariq@imp.internal', 'Bilal Tariq', 4, 'male', '+92 301 2223344', 'HBL', 'PK24HABB0002223344556677', 'Lead Estimator', 'Karachi'],
        ['zainab.malik', 'zainab.malik@imp.internal', 'Zainab Malik', 4, 'female', '+92 302 3334455', 'Bank Alfalah', 'PK12ALFH0003334455667788', 'Senior Estimator', 'Islamabad'],
        ['usman.ali', 'usman.ali@imp.internal', 'Usman Ali', 5, 'male', '+92 303 4445566', 'Standard Chartered', 'PK98SCBL0004445566778899', 'QA & Reviewer', 'Rawalpindi'],
        ['fatima.noor', 'fatima.noor@imp.internal', 'Fatima Noor', 4, 'female', '+92 304 5556677', 'MCB Bank', 'PK87MUCB0005556677889900', 'Estimator - Civil', 'Lahore'],
        ['hamza.sheikh', 'hamza.sheikh@imp.internal', 'Hamza Sheikh', 4, 'male', '+92 305 6667788', 'Faysal Bank', 'PK76FAYS0006667788990011', 'Estimator - MEP', 'Faisalabad'],
        ['ayesha.siddiqui', 'ayesha.siddiqui@imp.internal', 'Ayesha Siddiqui', 5, 'female', '+92 306 7778899', 'Allied Bank', 'PK65ABPA0007778899001122', 'Quality Auditor', 'Karachi'],
        ['omar.farooq', 'omar.farooq@imp.internal', 'Omar Farooq', 2, 'male', '+92 307 8889900', 'UBL', 'PK54UNIL0008889900112233', 'Operations Admin', 'Lahore'],
        ['maryam.iqbal', 'maryam.iqbal@imp.internal', 'Maryam Iqbal', 4, 'female', '+92 308 9990011', 'Askari Bank', 'PK43ASKA0009990011223344', 'Estimator - Finishes', 'Multan'],
        ['daniyal.reza', 'daniyal.reza@imp.internal', 'Daniyal Reza', 4, 'male', '+92 309 0001122', 'JazzCash', '03090001122', 'Junior Estimator', 'Peshawar']
    ];

    $defaultPasswordHash = Auth::hashPassword('User@12345');
    $seededUserIds = [];

    foreach ($usersData as $u) {
        $existing = Database::fetch("SELECT id FROM users WHERE username = :u", ['u' => $u[0]]);
        if ($existing) {
            $seededUserIds[] = $existing['id'];
        } else {
            $userId = Database::insert('users', [
                'username'       => $u[0],
                'email'          => $u[1],
                'password_hash'  => $defaultPasswordHash,
                'role_id'        => $u[3],
                'is_super_admin' => 0,
                'status'         => 'active',
                'created_at'     => date('Y-m-d H:i:s'),
                'updated_at'     => date('Y-m-d H:i:s'),
            ]);

            Database::insert('user_profiles', [
                'user_id'      => $userId,
                'full_name'    => $u[2],
                'phone'        => $u[5],
                'gender'       => $u[4],
                'joining_date' => date('Y-m-d', strtotime('-' . rand(30, 700) . ' days')),
                'hiring_date'  => date('Y-m-d', strtotime('-' . rand(35, 710) . ' days')),
                'notes'        => "Designation: {$u[8]}",
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ]);

            Database::insert('user_bank_accounts', [
                'user_id'                => $userId,
                'wallet_type'            => str_contains($u[6], 'Jazz') ? 'jazzcash' : 'bank_account',
                'account_title'          => $u[2],
                'account_number_or_iban' => $u[7],
                'bank_name'              => $u[6],
                'branch_code_or_name'    => 'Main City Branch',
                'is_primary'             => 1,
                'created_at'             => date('Y-m-d H:i:s'),
                'updated_at'             => date('Y-m-d H:i:s'),
            ]);

            Database::insert('user_addresses', [
                'user_id'        => $userId,
                'address_type'   => 'current',
                'address_line_1' => "House " . rand(10, 99) . ", Street " . rand(1, 20) . ", Sector " . chr(rand(65, 75)),
                'city'           => $u[9],
                'state'          => 'Punjab',
                'country'        => 'Pakistan',
                'created_at'     => date('Y-m-d H:i:s'),
                'updated_at'     => date('Y-m-d H:i:s'),
            ]);

            Database::insert('user_references', [
                'user_id'      => $userId,
                'name'         => "Reference for " . $u[2],
                'relationship' => 'Former Project Director',
                'phone'        => '+92 321 ' . rand(1000000, 9999999),
                'email'        => 'ref.' . $u[0] . '@industry.com',
                'organization' => 'Apex Engineering Corp',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ]);

            $seededUserIds[] = $userId;
        }
    }
    echo "  [OK] " . count($seededUserIds) . " Users with profiles, banks & addresses verified/seeded.\n";

    // ----------------------------------------------------
    // 3. SEED DYNAMIC CUSTOM FIELD DEFINITIONS
    // ----------------------------------------------------
    $customFields = [
        ['project', 'permit_number', 'Building Permit Number', 'text', null, 1],
        ['project', 'architect_firm', 'Architectural Design Firm', 'text', null, 1],
        ['project', 'target_margin_pct', 'Target Profit Margin (%)', 'decimal', null, 1],
        ['project', 'bonding_required', 'Bonding Required', 'select', json_encode(['Yes', 'No', 'N/A']), 1],
        ['project', 'csi_divisions_count', 'Estimated CSI Divisions', 'number', null, 1],
    ];

    foreach ($customFields as $cf) {
        $exists = Database::fetch("SELECT id FROM custom_field_definitions WHERE entity_type = :e AND field_key = :k", [
            'e' => $cf[0],
            'k' => $cf[1],
        ]);
        if (!$exists) {
            Database::insert('custom_field_definitions', [
                'entity_type'   => $cf[0],
                'field_key'     => $cf[1],
                'field_label'   => $cf[2],
                'field_type'    => $cf[3],
                'options_json'  => $cf[4],
                'show_in_table' => $cf[5],
                'created_at'    => date('Y-m-d H:i:s'),
                'updated_at'    => date('Y-m-d H:i:s'),
            ]);
        }
    }
    echo "  [OK] Dynamic Custom Field Definitions seeded.\n";

    // ----------------------------------------------------
    // 4. SEED 50+ DIVERSE REALISTIC PROJECTS
    // ----------------------------------------------------
    $projectTemplates = [
        ['Grand Central Medical Office Tower', 'commercial', '125,000 sq ft', 'G+8 Floors', 'Complete CSI Divisions 03-14 takeoff including structural concrete, glass curtainwall, MEP coordination, and medical gas lines.'],
        ['The Sapphire Luxury Residences', 'residential', '85,000 sq ft', 'G+14 Floors', 'High-end multi-family residential building. Full architectural finishes takeoff, marble tiling, custom millwork, and smart HVAC.'],
        ['Amazon Distribution Logistics Hub', 'industrial', '350,000 sq ft', 'Single Story 40ft Clear', 'Structural steel framing, precast insulated concrete tilt-wall panels, heavy-duty ESFR fire suppression and loading docks.'],
        ['Westfield Galleria Mall Renovation', 'commercial', '60,000 sq ft', '2 Floors', 'Demolition, seismic retrofit, new central atrium skylight, modern tenant demising walls, polished terrazzo flooring.'],
        ['Hilton Garden Inn Downtown', 'commercial', '95,000 sq ft', 'G+6 Floors', 'Full hospitality fitout: 180 guest suites, ballroom acoustics, commercial banquet kitchen, rooftop outdoor swimming terrace.'],
        ['St. Jude Outpatient Surgical Wing', 'commercial', '48,000 sq ft', '3 Floors', 'Class-100 cleanroom air filtration, heavy lead-lined X-ray shielding drywall, medical gas manifolds, backup UPS generators.'],
        ['Oakridge Senior Living Community', 'residential', '110,000 sq ft', '4 Floors', 'Independent living units, commercial dining, assisted mobility corridors, nurse call wiring, courtyard landscaping.'],
        ['Skyline Mixed-Use Tower Phase 2', 'mixed', '220,000 sq ft', 'G+22 Floors', 'Retail ground floor podium, 4 levels underground parking, 10 floors class-A office, and 8 floors luxury penthouses.'],
        ['ColdStorage Logistics Facility', 'industrial', '180,000 sq ft', 'Single Story', 'Heavy ammonia refrigeration piping, fast-acting insulated roll-up freezer doors, heavy insulated floor slab with sub-slab heating.'],
        ['Civic Center Municipal Library', 'commercial', '35,000 sq ft', '2 Floors', 'Mass timber glulam exposed beams, curved glass curtain walls, acoustic wood slat ceilings, high-efficiency geothermal HVAC.']
    ];

    $existingProjectsCount = (int)Database::fetchColumn("SELECT COUNT(*) FROM projects");

    if ($existingProjectsCount < 50) {
        $needed = 50 - $existingProjectsCount;
        echo "  [INFO] Generating {$needed} realistic project records with links, notes, and team members...\n";

        for ($i = 1; $i <= $needed; $i++) {
            $tmpl = $projectTemplates[array_rand($projectTemplates)];
            $codeNum = $existingProjectsCount + $i;
            $code = 'PRJ-' . date('Y') . '-' . str_pad((string)$codeNum, 4, '0', STR_PAD_LEFT);
            $clientId = $clientIds[array_rand($clientIds)];
            $statusId = rand(1, 9); // statuses 1 to 9
            $sourceId = rand(1, 3);
            $previewId = rand(1, 2);
            $budget = rand(35, 650) * 1000.00;
            $deduction = rand(0, 1) === 1 ? rand(10, 50) * 100.00 : 0.00;
            $points = rand(5, 50);
            $dueDate = date('Y-m-d', strtotime('+' . rand(5, 60) . ' days'));
            $isLate = rand(1, 10) === 1 ? 1 : 0;
            $creatorId = !empty($seededUserIds) ? $seededUserIds[array_rand($seededUserIds)] : 1;

            $title = $tmpl[0] . ' (Lot #' . rand(101, 999) . ')';

            $projectId = Database::insert('projects', [
                'project_code'      => $code,
                'project_title'     => $title,
                'client_id'         => $clientId,
                'project_address'   => rand(100, 9999) . ' ' . ['Grand Ave', 'Commercial Blvd', 'Industrial Way', 'Bayfront Pkwy', 'Liberty St'][rand(0, 4)] . ', Sector ' . rand(1, 15),
                'construction_type' => $tmpl[1],
                'project_area'      => $tmpl[2],
                'floor_number'      => $tmpl[3],
                'main_scope'        => $tmpl[4],
                'scope_details'     => "Full quantity takeoff based on Rev-C drawings. Excludes hazardous material abatement. Standard working hours apply.",
                'project_template'  => 'Standard CSI MasterFormat',
                'budget_total'      => $budget,
                'deduction_amount'  => $deduction,
                'project_points'    => $points,
                'due_date'          => $dueDate,
                'status_id'         => $statusId,
                'preview_status_id' => $previewId,
                'source_id'         => $sourceId,
                'is_late'           => $isLate,
                'created_by'        => $creatorId,
                'created_at'        => date('Y-m-d H:i:s', strtotime('-' . rand(1, 45) . ' days')),
                'updated_at'        => date('Y-m-d H:i:s'),
            ]);

            // Add links
            Database::insert('project_links', [
                'project_id' => $projectId,
                'link_type'  => 'initial_link',
                'label'      => 'Drawing Set (Rev-C).pdf',
                'url'        => 'https://cloud.imp.internal/plans/' . strtolower($code) . '_arch.pdf',
                'added_by'   => $creatorId,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            Database::insert('project_links', [
                'project_id' => $projectId,
                'link_type'  => 'spec_sheet',
                'label'      => 'Project Specifications & Addenda.pdf',
                'url'        => 'https://cloud.imp.internal/specs/' . strtolower($code) . '_specs.pdf',
                'added_by'   => $creatorId,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            // Add notes
            Database::insert('project_notes', [
                'project_id' => $projectId,
                'note_type'  => 'admin_notes',
                'content'    => 'Client requested priority pricing. Addenda #2 received and incorporated into scope.',
                'is_private' => 0,
                'created_by' => $creatorId,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            Database::insert('project_notes', [
                'project_id' => $projectId,
                'note_type'  => 'project_private_notes',
                'content'    => 'Confidential target margin: 24%. Estimator commission rate fixed at 2.5%.',
                'is_private' => 1,
                'created_by' => $creatorId,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            // Assign team members
            $assigneeCount = rand(1, 3);
            $randomUsers = (array)array_rand(array_flip($seededUserIds), $assigneeCount);
            foreach ($randomUsers as $uid) {
                Database::insert('project_team_members', [
                    'project_id'    => $projectId,
                    'user_id'       => $uid,
                    'member_role'   => ['Lead Estimator', 'Civil Estimator', 'MEP Specialist', 'QA Reviewer'][rand(0, 3)],
                    'member_status' => ['assigned', 'in_progress', 'needs_review', 'completed'][rand(0, 3)],
                    'started_at'    => date('Y-m-d', strtotime('-' . rand(1, 10) . ' days')),
                    'points_gain'   => rand(5, 25),
                    'notes'         => 'Assigned CSI Division takeoff packages.',
                    'created_at'    => date('Y-m-d H:i:s'),
                    'updated_at'    => date('Y-m-d H:i:s'),
                ]);
            }

            // Assign dynamic meta
            Database::insert('project_meta', [
                'project_id' => $projectId,
                'meta_key'   => 'permit_number',
                'meta_value' => 'BLD-' . date('Y') . '-' . rand(10000, 99999),
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            Database::insert('project_meta', [
                'project_id' => $projectId,
                'meta_key'   => 'architect_firm',
                'meta_value' => ['Gensler Architectural', 'Perkins & Will', 'HOK International', 'Skidmore Owings & Merrill'][rand(0, 3)],
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            Database::insert('project_meta', [
                'project_id' => $projectId,
                'meta_key'   => 'target_margin_pct',
                'meta_value' => (string)rand(18, 32),
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }
    }

    $finalCount = (int)Database::fetchColumn("SELECT COUNT(*) FROM projects");
    echo "  [OK] Total projects in database 'imp': {$finalCount}\n";

    Database::commit();
    echo "\n=== ALL DUMMY DATA SEEDED SUCCESSFULLY INTO 'imp' ===\n";

} catch (\Throwable $e) {
    Database::rollBack();
    echo "\n[ERROR] Seeding failed: " . $e->getMessage() . "\n";
    exit(1);
}

