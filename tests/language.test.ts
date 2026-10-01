import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSurveyCsv} from '../survey/model';
import {setActiveLanguage,translate as t} from '../ui/translations';
test('language changes preserve technical CSV columns and numeric survey values',()=>{
  const csv='Name,Latitude,Longitude,Easting,Northing,Elevation,Ellipsoidal height,Point photos,Solution status\nP1,48.30710952,11.65598703,696937.89,5353844.725,463.856,509.418,a.jpeg,FIX';
  setActiveLanguage('de');const german=parseSurveyCsv(csv).points;
  setActiveLanguage('en');const english=parseSurveyCsv(csv).points;
  assert.deepEqual(english,german);assert.equal(t('Breitengrad'),'Latitude');
  assert.equal(t('{count} Messpunkte',{count:107}),'107 survey points');
  assert.equal(t('ZIP erstellen 47 % …'),'Creating ZIP 47 % …');
  setActiveLanguage('de');assert.equal(t('Metadata inspector'),'Metadaten-Inspektor');
  assert.equal(t('Creating ZIP 47 % …'),'ZIP erstellen 47 % …');
});
