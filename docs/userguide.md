# Freeride Scorekeeping

## Intended Usage

The TJFS scorekeeping system is designed for scorekeeping for Junior Freeride comps. This scorekeeping system is designed for the following situations:

* Judges score skiers and snowboarders based on line, control, technique, fluidity, and style.
* The run order of competitor's first run is randomly sorted.

The following aspects of a competition are configurable in the scorekeeping system:

* Runs after the first one can be kept in the same order, reversed, or sorted by the score of prior runs.
* Competitions can be run individually or as part of a series.

## The Big Picture

* The details of the competition are configured in the registration Google Sheet spreadsheet.
* The athletes are loaded into the same registration spreadsheet.
* Generate startlists in the calculations Google Sheet spreadsheet.
* Enter scores in the data entry Google Sheets spreadsheets. There is a separate data entry spreadsheet for each day.
* View results in the calculations spreadsheet.

## Google Sheets

Data entry for the scorekeeping system is done in Google Sheets. Calculated output is generated in CSV format, which is easily viewed in Google Sheets.

Google Sheets allows multiple people to simultaneously edit into the same spreadsheet at the same time, which makes it easy to accelerate data entry by having multiple data entry people. Google Sheets offer some offline capabilities, but effectively using the scorekeeping system does require an internet connection.

The scorekeeping system utilizes several Google Sheets, each of which is explained below.

### Registration

The registration spreadsheet serves two purposes: configuring the scorekeeping system and entering athletes. This spreadsheet includes the following tabs.

#### competitors

There should be one row for each athlete. The following columns are required, and must be spelled exactly as shown:

* bib: This must uniquely identify each athlete. Digits and letter can be used. Spaces should be avoided.
* firstName
* lastName
* gender: "m" or "f"
* dob: In the format MM/DD/YYYY. The competition age is calculated from the date of birth.
* discipline: "ski" or "board"
* ifsaNumber: This is only used to send official results to the IFSA. If it is provided, it must be unique.

The order of the columns doesn't matter.

There must also be a column for each run of each competition for each athlete. These columns indicate if the athlete is competing in that run. This makes it easy to toggle the inclusion of athletes in the startlist. It also allows for series of events where an athlete competes in some of the competitions but not others. A "y" in the column indicates that the athlete is participating. A blank column indicates that they are not. The columns should be named with the id of the comp followed by a dash and the run number, i.e. "crystal-1" or "squaw-2"

Data can be copied and pasted into this spreadsheet one column at a time from Excel or another Google Sheet.

#### validation

This tab will show duplicate bib numbers and duplicate IFSA numbers. It will also show athletes that are too old or too young to complete.

#### competitions

This tab shows all the competitions in this series. If this isn't a series, then there will be a single competition.

#### divisions

The divisions are configurable in the scorekeeping system. Divisions are based on competition age and discipline, and can also optionally include gender. Some example of divisions would be:

* Boys skiers 7-11 years old
* Boys and Girls Snowboarders 12-13 years old

IFSA scoring uses a specific set of divisions which should be included in the spreadsheet if the scores will be sent to the IFSA. The scorekeeping system can simultaneously accommodate multiple division sets, so the comp can use its own set of divisions and also send results to the IFSA using the divisions they expect.

#### compdivisions

Run orders

#### Registration tabs

### Data Entry

### Calculations

### "Save to s3"

Any data entered in any of the scorekeeping Google Sheets must be uploaded to Amazon S3 so that the scorekeeping system can access it. Every scorekeeping Google Sheet that allows data to be entered has "tjfs" menu with a "Save to s3" option. The first time data is saved to s3 from a Google Sheet, it will ask for your permission. The scorekeeping system will not work until this access is granted.