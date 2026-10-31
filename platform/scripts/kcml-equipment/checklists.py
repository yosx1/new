"""Cold-run checklists by equipment type (KCML 2026 equipment list).

Each equipment gets the checks of its type for the four disciplines. Codes follow the plant's
tag system: <area><line><letter><number>, where M = motor/drive, Y = valve/actuator, A = cabinet.
Only checks that can be made in a cold (no-load, no-material) run are listed.
"""

# ---------- building blocks ----------
MOTOR_E = [
    'Motor insulation resistance (megger) measured and recorded',
    'Terminal box: connections tight, cable gland sealed, cover closed',
    'Motor and frame earthing connected',
    'MCC feeder: breaker, contactor and overload setting checked',
    'Local control station: local/remote selector and emergency stop tested',
    'Direction of rotation verified (bump test)',
    'No-load current recorded and balanced on the three phases',
]
MOTOR_M = [
    'Base frame and anchor bolts tight',
    'Coupling alignment checked and coupling guard fitted',
    'Bearings lubricated (grease / oil level)',
    'Turns freely by hand; no abnormal noise, heat or vibration while running',
    'Guards and safety covers in place',
]
GEAR_M = ['Gearbox oil level and condition checked; breather clean; no leaks']
PROD = [
    'Area clean; tools, scaffolding and materials removed',
    'Start / stop from CCR checked and running signal received',
    'Interlocks and start sequence verified with CCR',
]
PROD_SMALL = ['Start / stop and running signal checked from CCR', 'Area clean; tools and materials removed']
LIMITS = 'Open / close limit switches and position feedback correct in CCR'
SPEED = 'Zero-speed / speed monitor tested and signal received in CCR'


def T(mech=(), elec=(), instr=(), prod=(), motor=True, gear=False, small=False):
    """A template: motor/gear blocks are added in front of the type-specific checks."""
    m = (MOTOR_M if motor else []) + (GEAR_M if gear else []) + list(mech)
    e = (MOTOR_E if motor else []) + list(elec)
    p = list(prod) + (PROD_SMALL if small else PROD)
    return {'mechanical': m, 'electrical': e, 'instrumentation': list(instr), 'production': p}


TEMPLATES = {
    'main_drive': T(
        mech=['Main gearbox / girth gear lubrication system filled and circulating', 'Holding-down bolts of motor, gearbox and pinion tight',
              'Barring / auxiliary drive disengaged after turning'],
        elec=['MV/LV switchgear and protection relay tested', 'Motor space heater working', 'Winding and bearing RTD (PT100) resistance checked',
              'Cooling fan of main motor running in the right direction'],
        instr=['Bearing temperature signals in CCR', 'Winding temperature signals in CCR', 'Vibration monitoring active and alarms set',
               'Lube oil pressure / flow switches tested (start permissive)'],
        prod=['All start permissives shown healthy in CCR', 'Emergency stop of the main drive tested'], gear=True),
    'large_fan': T(
        mech=['Impeller clean, no build-up; clearance to casing checked', 'Inspection doors closed and sealed',
              'Damper / inlet vanes move freely over full stroke', 'Bearing housing oil level / cooling water checked'],
        elec=['MV/LV switchgear and protection relay tested', 'Motor space heater working', 'Winding and bearing RTD (PT100) resistance checked'],
        instr=['Bearing temperature signals in CCR', 'Vibration monitoring active and alarms set', 'Damper position feedback matches CCR command',
               'Draft / pressure transmitters reading correctly'],
        prod=['Damper closed for start (start permissive)', 'Emergency stop tested']),
    'fan': T(
        mech=['Impeller clean and balanced; no rubbing', 'Belt tension and pulley alignment checked (belt drive)', 'Damper / shutter moves freely',
              'Inspection doors closed'],
        instr=['Damper position / pressure switch (if fitted) signal in CCR'], small=True),
    'cooling_air_fan': T(
        mech=['Impeller clean and free; no rubbing', 'Inlet screen / silencer clean and fixed', 'Damper / valve moves freely over full stroke'],
        instr=['Air flow / pressure transmitter reading', 'Damper position feedback in CCR'], small=True),
    'blower': T(
        mech=['Inlet filter / silencer clean', 'V-belt tension and guard checked', 'Oil level in blower gearbox checked',
              'Safety (relief) valve and non-return valve free', 'No air leaks on discharge line'],
        instr=['Discharge pressure gauge / switch working', 'Pressure signal in CCR'], small=True),
    'compressor': T(
        mech=['Oil level and oil filter checked', 'Air filter clean', 'Condensate drain working', 'Safety valve and pressure setting checked',
              'Air receiver and piping: no leaks'],
        elec=['Compressor control panel and alarms checked'],
        instr=['Pressure switches / transmitter set and tested', 'Temperature switch tested', 'Load / unload operation checked'], small=True),
    'belt_conveyor': T(
        mech=['Belt tracking and splices checked', 'Belt tension / take-up checked', 'Idlers and return rollers turning freely',
              'Head and tail pulleys, lagging checked', 'Belt scrapers / cleaners adjusted', 'Skirt boards and chutes clear'],
        instr=['Pull-cord switches tested along the conveyor', 'Belt sway (misalignment) switches tested', SPEED,
               'Chute blockage switch tested (if fitted)'], gear=True),
    'screw_conveyor': T(
        mech=['Trough clean; inlet and outlet clear', 'Screw flights and hanger bearings checked', 'Covers bolted and sealed'],
        instr=[SPEED], gear=True),
    'bucket_elevator': T(
        mech=['Chain / belt tension and take-up checked', 'Buckets and bucket bolts checked', 'Boot section clean; inspection doors closed',
              'Backstop (holdback) working', 'Auxiliary drive disengaged'],
        instr=[SPEED, 'Belt / chain misalignment switches tested', 'Boot level / blockage switch tested'], gear=True),
    'apron_feeder': T(
        mech=['Pans and chain checked; no damaged pans', 'Support rollers and sprockets checked', 'Skirt plates and seals checked', 'Chain tension correct'],
        instr=[SPEED, 'Speed control (VFD) reference and feedback in CCR'], gear=True),
    'weigh_feeder': T(
        mech=['Belt tracking and tension checked', 'Weighing idler and load-cell area clean', 'Skirts and inlet gate clear'],
        instr=['Load cell checked; zero and span calibration done', 'Speed sensor tested', 'Feed rate set-point / feedback in CCR'], gear=True),
    'air_slide': T(
        mech=['Air-slide fabric checked; no tears', 'Covers and inspection windows sealed', 'Inlet/outlet chutes clear', 'Aeration blower connection tight'],
        motor=False, instr=['Aeration pressure switch / gauge working'], small=True),
    'airlock': T(
        mech=['Rotor turns freely; tip clearance checked', 'Seals and flanges tight'], instr=[SPEED], gear=True),
    'gate': T(
        mech=['Moves freely over the full stroke; no obstruction', 'Spindle / linkage lubricated', 'Seals and flanges tight'],
        instr=[LIMITS, 'Stroke time within limits'], gear=True, small=True),
    'valve': T(
        mech=['Valve moves freely over the full stroke', 'Linkage / spindle lubricated', 'Gland and flanges: no leaks'],
        motor=False, elec=['Actuator supply and wiring checked', 'Earthing connected'],
        instr=[LIMITS, 'Stroke time within limits'], small=True),
    'solenoid_valve': T(
        mech=['Valve body and connections: no leaks'], motor=False,
        elec=['Coil resistance and supply voltage checked', 'Wiring and earthing checked'],
        instr=['Valve operates on command from CCR', 'Position feedback (if fitted) correct'], small=True),
    'lube_unit': T(
        mech=['Oil tank level and oil condition checked', 'Filters clean', 'No leaks on pipes and fittings', 'Pressure relief valve set'],
        elec=['Oil heater working (if fitted)'],
        instr=['Oil pressure switch / transmitter tested', 'Flow switch tested', 'Oil level and temperature switches tested'], small=True),
    'girth_lube': T(
        mech=['Grease / oil barrel level checked', 'Spray nozzles clean and spray pattern checked', 'Lines and fittings: no leaks'],
        instr=['Spray cycle timer set', 'Pressure switch and alarm tested'], small=True),
    'hydraulic': T(
        mech=['Hydraulic oil level and condition checked', 'Filters clean', 'Hoses and fittings: no leaks', 'Accumulator pre-charge checked'],
        instr=['Pressure switches / transmitter tested', 'Oil level and temperature switches tested'], small=True),
    'pump': T(
        mech=['Mechanical seal / gland: no leaks', 'Suction and discharge valves lined up', 'Pump primed and vented', 'Strainer clean'],
        instr=['Suction / discharge pressure gauges working', 'Flow / pressure transmitter signal in CCR', 'Tank level switches tested (dry-run protection)']),
    'hfo_pump': T(
        mech=['Mechanical seal: no leaks', 'Suction and discharge valves lined up', 'Strainer clean', 'Heat tracing / insulation intact'],
        instr=['Pressure gauges / transmitters working', 'Temperature reading of the oil', 'Tank level switches tested']),
    'cooling_tower': T(
        mech=['Fan blades and pitch checked', 'Gearbox oil level checked', 'Drift eliminators and fill clean', 'Basin clean; make-up valve working'],
        instr=['Basin level switch tested', 'Water temperature reading', 'Vibration switch tested (if fitted)'], gear=True),
    'vibrator': T(
        mech=['Mounting bolts tight', 'Eccentric weights set and covers fitted'], small=True),
    'rapping': T(
        mech=['Hammers and shaft checked; no broken hammers', 'Gear motor mounting tight'],
        instr=['Rapping cycle timer / sequence set'], gear=True, small=True),
    'dust_collector': T(
        mech=['Filter bags / cartridges in good condition', 'Cleaning system (pulse valves, air header) working', 'Hopper empty; discharge clear',
              'Doors and covers sealed'],
        instr=['Differential pressure gauge / transmitter reading', 'Cleaning timer set and solenoids pulsing'], small=True),
    'separator': T(
        mech=['Rotor turns freely; seals checked', 'Guide vanes and rotor blades checked', 'Bearings lubricated'],
        instr=['Speed (VFD) reference and feedback in CCR', 'Bearing temperature / vibration signals'], gear=True),
    'crusher': T(
        mech=['Rolls / hammers and liners checked', 'Gap setting checked', 'Hydraulic / lubrication system ready'],
        instr=['Bearing temperature signals', 'Speed monitor tested'], gear=True),
    'crane': T(
        mech=['Hoist brake tested', 'Wire rope and hook checked', 'Travel wheels and rails checked'],
        elec=['Pendant / remote control tested'], instr=['Hoist and travel limit switches tested', 'Overload protection tested'], gear=True, small=True),
    'brake': T(
        mech=['Brake lining and drum / disc checked', 'Brake releases and applies correctly'],
        instr=['Brake released / applied limit switch tested'], small=True),
    'aux_drive': T(
        mech=['Clutch / coupling engages and disengages correctly', 'Auxiliary gearbox oil level checked'],
        instr=['Engaged / disengaged position switch tested (interlock with main drive)'], gear=True, small=True),
    'starter': T(
        mech=[], motor=False,
        elec=['Starter connections tight; no overheating marks', 'Electrolyte level / resistor bank checked (liquid starter)',
              'Starter control and protection tested', 'Earthing connected'],
        instr=['Start / end-position signals in CCR'], small=True),
    'cabinet': T(
        mech=[], motor=False,
        elec=['Wiring and terminals tight', 'Power supply and fuses / breakers checked', 'Earthing and door seals checked', 'Panel heater / cooling working'],
        instr=['Signals and alarms to CCR checked'], small=True),
    'level_sensor': T(
        mech=['Sensor mounting tight and clean'], motor=False, elec=['Supply and wiring checked'],
        instr=['Sensor calibrated / tested', 'Level signal and alarm in CCR'], small=True),
    'packer': T(
        mech=['Filling spouts and bag clamps checked', 'Rotation / indexing smooth', 'Seals and air connections tight'],
        instr=['Weighing system calibrated (test weights)', 'Bag-present and spout sensors tested'], gear=True),
    'spout': T(
        mech=['Spout, bag clamp and seals checked', 'Air connections: no leaks'], motor=False,
        elec=['Wiring and solenoids checked'], instr=['Spout sensors and weighing cell checked'], small=True),
    'roller_conveyor': T(
        mech=['Rollers turning freely', 'Chains / belts tension checked', 'Bag guides adjusted'], instr=['Bag detection sensors tested'], gear=True, small=True),
    'bag_handling': T(
        mech=['Moving parts free; guards fitted', 'Cutting / feeding elements checked'], instr=['Sensors and limit switches tested'], gear=True, small=True),
    'screen': T(
        mech=['Screen deck / mesh checked', 'Springs / mountings checked'], small=True),
    'chute_2way': T(
        mech=['Flap moves freely between both positions', 'Seals and liners checked'], instr=[LIMITS], gear=True, small=True),
    'pan_conveyor': T(
        mech=['Pans and chains checked', 'Rollers and sprockets checked', 'Chain tension correct'], instr=[SPEED, 'Pull-cord switches tested'], gear=True),
    'drag_chain': T(
        mech=['Chain and flights checked', 'Chain tension correct', 'Casing doors closed'], instr=[SPEED], gear=True),
    'winch': T(
        mech=['Rope and drum checked', 'Brake tested'], instr=['Limit switches tested'], gear=True, small=True),
    'burner_carriage': T(
        mech=['Carriage rails and wheels checked', 'Hoses and cables free to move'], instr=['Travel limit switches tested'], gear=True, small=True),
    'sampler': T(
        mech=['Sampler cutter / screw moves freely', 'Sample line clear'], instr=['Sampler cycle timer set'], gear=True, small=True),
    'cleaning_unit': T(
        mech=['Cleaning mechanism moves freely over full travel'], instr=['Travel / end limit switches tested'], gear=True, small=True),
    'well_pump': T(
        mech=['Discharge valve and non-return valve checked', 'Well head and piping: no leaks'],
        instr=['Pressure gauge working', 'Dry-run / level protection tested', 'Flow meter reading']),
    'magnetic_separator': T(
        mech=['Magnet belt tracking and tension checked', 'Magnet suspension and clearance to the conveyor checked'],
        elec=['Magnet coil insulation and supply checked'], instr=['Magnet on / belt running signals in CCR'], gear=True, small=True),
    'travel_drive': T(
        mech=['Wheels and rails checked', 'Brakes tested'], instr=['Travel limit switches tested'], gear=True, small=True),
    'motor': T(gear=False, small=True),            # a drive whose type is not given in the list
    'gear_motor': T(gear=True, small=True),
}

# keyword rules, first match wins (checked against the lower-case, spelling-corrected type text)
RULES = [
    (('level sensor',), 'level_sensor'),
    (('electrical cabinet',), 'cabinet'),
    (('solenoid',), 'solenoid_valve'),
    (('pneumatic flap',), 'valve'),
    (('cooling fan for main drive', 'cooling system for main motor', 'cooling system for the motor', 'cooling fan shaft bearing'), 'fan'),
    (('vibrator to cooling fan', 'filter vibrator'), 'vibrator'),
    (('id fan', 'by-pass fan', 'ep fan', 'main burner fan', 'calciner burner fan', 'main drive rm fan'), 'large_fan'),
    (('main drive', 'main motor for kiln'), 'main_drive'),
    (('cooling air fan', 'cooler air fan', 'cooling fan for first stage'), 'cooling_air_fan'),
    (('compressor',), 'compressor'),
    (('hfo pump', 'thermal oil', 'unloading pump', 'low pressure pump'), 'hfo_pump'),
    (('water well',), 'well_pump'),
    (('girth gear',), 'girth_lube'),
    (('lubrication',), 'lube_unit'),
    (('hydraulic',), 'hydraulic'),
    (('pump',), 'pump'),
    (('cooling tower',), 'cooling_tower'),
    (('rapping',), 'rapping'),
    (('air slide from',), 'air_slide'),
    (('vibrator',), 'vibrator'),
    (('auxiliary drive', 'auxiliary kiln drive'), 'aux_drive'),
    (('2-way gate from',), 'chute_2way'),
    (('slide gate for airslide',), 'gate'),
    (('bucket elevator',), 'bucket_elevator'),
    (('weigh feeder',), 'weigh_feeder'),
    (('apron',), 'apron_feeder'),
    (('pan conveyor dropping', 'slide gate to pan'), 'gate'),
    (('winch',), 'winch'),
    (('pan conveyor',), 'pan_conveyor'),
    (('drag chain',), 'drag_chain'),
    (('roller press (for belt', 'roller press(for belt'), 'bag_handling'),
    (('roller press', 'small crusher', 'clinker crusher', 'lump breaker'), 'crusher'),
    (('magnetic separator',), 'magnetic_separator'),
    (('belt conveyor', 'gear motor for belt', 'conveyor motor'), 'belt_conveyor'),
    (('brake',), 'brake'),
    (('screw',), 'screw_conveyor'),
    (('air slide blower', 'fan for air slide', 'air blower for air slide'), 'blower'),
    (('air slide gate', 'slide vane'), 'gate'),
    (('air slide',), 'air_slide'),
    (('airlock', 'air lock'), 'airlock'),
    (('blower', 'aeration'), 'blower'),
    (('2-way chute', '2-way gate', 'diverter'), 'chute_2way'),
    (('valve', 'damper', 'gate', 'flap'), 'gate'),
    (('fan for dust',), 'fan'),
    (('dust collector',), 'dust_collector'),
    (('separator air fan',), 'fan'),
    (('separator',), 'separator'),
    (('crane',), 'crane'),
    (('burner carriage',), 'burner_carriage'),
    (('sampler',), 'sampler'),
    (('cleaning unit',), 'cleaning_unit'),
    (('packing machine', 'drive unit'), 'packer'),
    (('spout',), 'spout'),
    (('roller conveyor',), 'roller_conveyor'),
    (('cutting roller', 'bag feeder', 'bag shifter'), 'bag_handling'),
    (('screen',), 'screen'),
    (('travel drive',), 'travel_drive'),
    (('fan', 'vacuum system'), 'fan'),
    (('gear motor', 'gearbox', 'motor reducer'), 'gear_motor'),
]
STARTERS = {'liquid starter', 'motor starter', 'starter', 'motor starter drive side'}


def classify(type_text: str, code: str) -> str:
    t = ' '.join(type_text.lower().split())
    actuator = len(code) > 2 and code[2] == 'Y'      # Y = valve / actuator in the plant's tag system
    if t in STARTERS: return 'starter'
    if not t: return 'valve' if actuator else 'motor'
    if actuator and 'solenoid' not in t:
        # Y-tagged items are valves / dampers; a motor-driven one gets the motorized gate checklist
        return 'gate' if 'motor' in t else 'valve'
    for keys, kind in RULES:
        if any(k in t for k in keys):
            return kind
    return 'motor'
