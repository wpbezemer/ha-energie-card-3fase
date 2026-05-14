# ha-energie-card-3fase

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![HA](https://img.shields.io/badge/Home%20Assistant-Lovelace-blue)](https://www.home-assistant.io/)

Home Assistant Lovelace custom card voor **3-fase energiemeting**. Toont per fase het actuele verbruik én teruglevering met geanimeerde vermogenspijltjes, spanning, stroom en een voortgangsbalk. Optioneel uitbreidbaar met een **SolarEdge live productie** blok.

---

## Schermafbeelding

> *(voeg hier een screenshot toe van je dashboard)*

---

## Functies

| Functie | Details |
|---------|---------|
| **3-fase weergave** | L1, L2 en L3 elk als eigen blok met vermogen, spanning en stroom |
| **Geanimeerde pijltjes** | Richting en snelheid schalen mee met het actuele vermogen |
| **Verbruik én teruglevering** | Per fase automatisch omgeschakeld op basis van de sensorwaarden |
| **Voortgangsbalk per fase** | Visuele indicator t.o.v. het ingestelde maximum |
| **Totaaloverzicht** | Totaal verbruik en totale teruglevering over alle 3 fasen |
| **SolarEdge blok** | Optioneel live productieblok met vermogen, stroom, balk en pulserend indicatiebolletje |
| **Visuele editor** | Volledig configureerbaar via de HA kaarteditor — geen YAML verplicht |
| **W en kW** | Sensor-eenheid instelbaar per fase (`W` of `kW`) |
| **Aanpasbaar maximum** | Max afname en max teruglevering per fase instelbaar voor de balk-schaal |

---

## Installatie

### Via HACS (aanbevolen)

1. Ga in Home Assistant naar **HACS → Frontend**
2. Klik op **⋮ → Aangepaste repositories**
3. Voeg toe: `https://github.com/jouwgebruikersnaam/ha-energie-card-3fase` — categorie: **Lovelace**
4. Zoek op **Energie 3 Fase** en klik op **Downloaden**
5. Herlaad de browser (**Ctrl+Shift+R**)

### Handmatig

1. Download `energie-card-3fase.js`
2. Kopieer het bestand naar `/config/www/energie-card-3fase.js`
3. Ga naar **Instellingen → Dashboards → ⋮ → Bronnen beheren → Toevoegen**:
   - URL: `/local/energie-card-3fase.js`
   - Type: **JavaScript module**
4. Herlaad de browser (**Ctrl+Shift+R**)
5. Voeg een nieuwe kaart toe en zoek op **Energie 3 Fase**

---

## Configuratie

### Minimale configuratie

```yaml
type: custom:energie-card-3fase
```

Zonder configuratie gebruikt de card de standaard sensor-namen van de DSMR-integratie.

### Volledige configuratie (YAML)

```yaml
type: custom:energie-card-3fase
phases:
  L1:
    power_consume: sensor.dsmr_reading_electricity_currently_delivered_l1
    power_return:  sensor.p1_power_return_l1
    current:       sensor.dsmr_current_l1
    voltage:       sensor.dsmr_voltage_l1
    unit:          kW          # kW of W
    max_consume:   5750        # max afname in W (25A × 230V = 5750)
    max_return:    5750        # max teruglevering in W
  L2:
    power_consume: sensor.dsmr_reading_electricity_currently_delivered_l2
    power_return:  sensor.p1_power_return_l2
    current:       sensor.dsmr_current_l2
    voltage:       sensor.dsmr_voltage_l2
    unit:          kW
    max_consume:   5750
    max_return:    5750
  L3:
    power_consume: sensor.dsmr_reading_electricity_currently_delivered_l3
    power_return:  sensor.p1_power_return_l3
    current:       sensor.dsmr_current_l3
    voltage:       sensor.dsmr_voltage_l3
    unit:          kW
    max_consume:   5750
    max_return:    5750
```

### Met SolarEdge (optioneel)

Voeg onderaan de configuratie toe:

```yaml
solaredge:
  power:     sensor.solaredge_current_power   # actueel vermogen
  current:   sensor.solaredge_current_dc      # stroom in Ampere (optioneel)
  max_power: 8000                             # piek van je installatie in W
  unit:      W                                # W of kW
```

---

## Configuratieopties

### Per fase (`phases.L1`, `phases.L2`, `phases.L3`)

| Optie | Standaard | Omschrijving |
|-------|-----------|-------------|
| `power_consume` | `sensor.dsmr_reading_electricity_currently_delivered_l1` | Afname sensor |
| `power_return` | `sensor.p1_power_return_l1` | Teruglevering sensor |
| `current` | `sensor.dsmr_current_l1` | Stroom sensor (A) |
| `voltage` | `sensor.dsmr_voltage_l1` | Spanning sensor (V) |
| `unit` | `kW` | Eenheid van de vermogen-sensoren (`kW` of `W`) |
| `max_consume` | `5750` | Maximum afname in W — bepaalt de schaal van de balk |
| `max_return` | `5750` | Maximum teruglevering in W — bepaalt de schaal van de balk |

### SolarEdge (`solaredge`)

| Optie | Standaard | Omschrijving |
|-------|-----------|-------------|
| `power` | `sensor.solaredge_current_power` | Actueel vermogen sensor |
| `current` | `sensor.solaredge_current_dc` | Stroom sensor (optioneel) |
| `max_power` | `8000` | Piek vermogen van je installatie in W |
| `unit` | `W` | Eenheid van de vermogen sensor (`W` of `kW`) |

---

## Hoe werken de pijltjes?

- **Richting**: pijltjes wijzen naar rechts (▶) bij afname, naar links (◀) bij teruglevering
- **Aantal**: 1 tot 6 pijltjes — schaalt met het percentage van het maximum
- **Snelheid**: hoe meer vermogen, hoe sneller de animatie
- **Kleur**: groen bij afname, blauw bij teruglevering

Bij 0W staat de animatie stil.

---

## Benodigde sensoren

De card verwacht per fase twee vermogen-sensoren: één voor afname en één voor teruglevering. Als je de [esp8266_p1meter](https://github.com/wpbezemer/esp8266_p1meter) firmware gebruikt, zijn dit:

```
homeassistant/sensor/p1meter/l1_instant_power_usage/state   → afname L1
homeassistant/sensor/p1meter/l1_instant_power_return/state  → teruglevering L1
homeassistant/sensor/p1meter/l1_instant_power_current/state → stroom L1
homeassistant/sensor/p1meter/l1_voltage/state               → spanning L1
```

Hetzelfde patroon geldt voor L2 en L3.

---

## Credits

Gemaakt als aanvulling op de [esp8266_p1meter](https://github.com/wpbezemer/esp8266_p1meter) firmware die DSMR5 P1 data via MQTT naar Home Assistant stuurt.

---

*Licentie: MIT*
