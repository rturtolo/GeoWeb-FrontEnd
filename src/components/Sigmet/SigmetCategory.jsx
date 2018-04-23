import React, { Component } from 'react';
import { Button, ButtonGroup, Col, Row, Badge, Card, CardHeader, CardBlock, Alert, Input, InputGroupAddon, InputGroup } from 'reactstrap';
import Moment from 'react-moment';
import moment from 'moment';
import Icon from 'react-fa';
import axios from 'axios';
import cloneDeep from 'lodash.clonedeep';
import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import range from 'lodash.range';
import update from 'immutability-helper';
import CollapseOmni from '../CollapseOmni';
import SwitchButton from 'lyef-switch-button';
import 'lyef-switch-button/css/main.css';
import { Typeahead } from 'react-bootstrap-typeahead';
import DateTimePicker from 'react-datetime';

import Slider from 'rc-slider';
import Tooltip from 'rc-tooltip';
import PropTypes from 'prop-types';
import { SIGMET_TEMPLATES, CHANGES, DIRECTIONS, UNITS_ALT } from './SigmetTemplates';

const createSliderWithTooltip = Slider.createSliderWithTooltip;
const Range = createSliderWithTooltip(Slider.Range);
const Handle = Slider.Handle;

const DATE_FORMAT = 'DD MMM YYYY';
const TIME_FORMAT = 'HH:mm UTC';
const DATE_TIME_FORMAT = 'DD MMM YYYY HH:mm UTC';
const SEPARATOR = '_';
const TAG_NAMES = {
  DIV: 'div',
  SPAN: 'span'
};
const EMPTY_GEO_JSON = cloneDeep(SIGMET_TEMPLATES.GEOJSON);
const EMPTY_SIGMET = cloneDeep(SIGMET_TEMPLATES.SIGMET);
EMPTY_SIGMET.validdate = moment().utc().format();
EMPTY_SIGMET.validdate_end = moment().utc().add(4, 'hour').format();

const FALLBACK_PARAMS = {
  maxhoursofvalidity: 4,
  hoursbeforevalidity: 4,
  firareas: [
    {
      location_indicator_icao: 'EHAA',
      firname: 'AMSTERDAM FIR',
      areapreset: 'NL_FIR'
    }
  ],
  location_indicator_wmo: 'EHDB'
};

class SigmetCategory extends Component {
  constructor (props) {
    super(props);
    this.onObsOrFcstClick = this.onObsOrFcstClick.bind(this);
    this.handleSigmetClick = this.handleSigmetClick.bind(this);
    this.handleActionClick = this.handleActionClick.bind(this);
    this.saveSigmet = this.saveSigmet.bind(this);
    this.deleteDrawing = this.deleteDrawing.bind(this);
    this.publishSigmet = this.publishSigmet.bind(this);
    this.savedSigmetCallback = this.savedSigmetCallback.bind(this);
    this.getExistingSigmets = this.getExistingSigmets.bind(this);
    this.gotExistingSigmetsCallback = this.gotExistingSigmetsCallback.bind(this);
    this.setSelectedMovement = this.setSelectedMovement.bind(this);
    this.setSetMovementType = this.setSetMovementType.bind(this);
    this.setSelectedDirection = this.setSelectedDirection.bind(this);
    this.setSpeed = this.setSpeed.bind(this);
    this.setChange = this.setChange.bind(this);
    this.setTops = this.setTops.bind(this);
    this.selectFir = this.selectFir.bind(this);

    this.state = {
      isOpen: props.isOpen,
      isClosing: props.isClosing,
      list: [EMPTY_SIGMET],
      renderRange: false,
      lowerUnit: UNITS_ALT.FL
    };
  }

  // get Human Readable Text for Code
  getHRT4code (code) {
    const { phenomenonMapping } = this.props;
    const UNKNOWN = 'Unknown';
    if (!phenomenonMapping) {
      return UNKNOWN;
    }
    if (typeof code === 'undefined') {
      return UNKNOWN;
    }
    const codeFragments = code.split(SEPARATOR);
    if (codeFragments.length < 2) {
      return UNKNOWN;
    }
    let result = '';
    let variantIndex;
    let additionIndex;
    let effectiveMapping = cloneDeep(phenomenonMapping).filter((item) => code.startsWith(item.phenomenon.code));
    if (effectiveMapping.length === 1) {
      if (effectiveMapping[0].phenomenon.code === code) {
        effectiveMapping[0].variants = [];
        effectiveMapping[0].additions = [];
      }
    } else {
      effectiveMapping = cloneDeep(phenomenonMapping).map((item) => {
        if (item.variants.length > 0) {
          variantIndex = item.variants.findIndex((variant) => codeFragments[0].startsWith(variant.code));
          if (variantIndex > -1) {
            item.variants = [item.variants[variantIndex]];
            return item;
          }
        } else if (item.phenomenon.code.startsWith(codeFragments[0])) {
          return item;
        }
      }).filter((item) => typeof item !== 'undefined').filter((item) => {
        if (item.variants.length > 0) {
          return codeFragments[1].startsWith(item.phenomenon.code);
        } else {
          return true;
        }
      }).map((item) => {
        if (item.additions.length > 0) {
          additionIndex = item.additions.findIndex((addition) => codeFragments[1].endsWith(addition.code));
          if (additionIndex > -1) {
            item.additions = [item.additions[additionIndex]];
            return item;
          } else if (codeFragments.length > 2) {
            additionIndex = item.additions.findIndex((addition) => codeFragments[2].endsWith(addition.code));
            if (additionIndex > -1) {
              item.additions = [item.additions[additionIndex]];
              return item;
            }
          }
        }
        item.additions = [];
        return item;
      });
    }
    if (effectiveMapping.length === 1) {
      if (effectiveMapping[0].variants.length === 1) {
        result = effectiveMapping[0].variants[0].name + ' ' + effectiveMapping[0].phenomenon.name.toLowerCase();
      } else if (effectiveMapping[0].variants.length === 0) {
        result = effectiveMapping[0].phenomenon.name;
      } else {
        result = UNKNOWN;
      }
      if (effectiveMapping[0].additions.length === 1) {
        result += ' ' + effectiveMapping[0].additions[0].name;
      }
      return result;
    }
    return UNKNOWN;
  }

  getPhenomena () {
    const { phenomenonMapping } = this.props;
    let result = [];
    if (Array.isArray(phenomenonMapping)) {
      phenomenonMapping.forEach((item) => {
        if (item.variants.length === 0) {
          const res = {
            name: item.phenomenon.name,
            code: item.phenomenon.code,
            layerpreset: item.phenomenon.layerpreset
          };
          item.additions.forEach((addition) => {
            result.push({
              name: res.name + ' ' + addition.name,
              code: res.code + SEPARATOR + addition.code,
              layerpreset: item.phenomenon.layerpreset
            });
          });
          result.push(res);
        } else {
          item.variants.forEach((variant) => {
            const res = {
              name: variant.name + ' ' + item.phenomenon.name.toLowerCase(),
              code: variant.code + SEPARATOR + item.phenomenon.code,
              layerpreset: item.phenomenon.layerpreset
            };
            item.additions.forEach((addition) => {
              result.push({
                name: res.name + ' ' + addition.name,
                code: res.code + addition.code,
                layerpreset: item.phenomenon.layerpreset
              });
            });
            result.push(res);
          });
        }
      });
    }
    return result;
  }

  getParameters () {
    let { parameters } = this.props;
    if (isEmpty(parameters)) {
      parameters = FALLBACK_PARAMS;
    }
    return parameters;
  }

  hasTagName (element, tagName) {
    return element.tagName.toLowerCase() === tagName;
  }

  handleSigmetClick (evt, index) {
    let shouldContinue = false;
    if (!this.props.editable) {
      shouldContinue = true;
    } else if (this.props.selectedIndex !== 0) {
      shouldContinue = true;
    } else if (this.hasTagName(evt.target, TAG_NAMES.DIV) && evt.target.classList.contains('row')) {
      shouldContinue = true;
    } else if (this.hasTagName(evt.target, TAG_NAMES.SPAN) && evt.target.classList.contains('badge')) {
      shouldContinue = true;
    }

    if (shouldContinue) {
      this.props.selectMethod(index, this.state.list[index].geojson);
    }
  }

  selectFir (destinationFeatureNr) {
    const { dispatch, drawActions } = this.props;
    return new Promise((resolve, reject) => {
      axios({
        method: 'get',
        url: 'geojson/AMSTERDAM_FIR.geojson',
        withCredentials: true,
        responseType: 'json'
      }).then(src => {
        if (src.data) {
          this.setState({ fir: src.data });
        }
        let newGeoJson = cloneDeep(this.props.drawProperties.adagucMapDraw.geojson);
        newGeoJson.features[destinationFeatureNr].geometry = cloneDeep(src.data.features[0].geometry);
        dispatch(drawActions.setGeoJSON(newGeoJson));
        resolve('Fetched FIR');
      }).catch(error => {
        reject(error);
      });
    });
  }

  deleteDrawing (destinationFeatureNr) {
    const { dispatch, drawActions } = this.props;
    const newList = cloneDeep(this.state.list); /* TODO: What is state.list? */

    let newGeoJson = cloneDeep(this.props.drawProperties.adagucMapDraw.geojson);
    newGeoJson.features[destinationFeatureNr].geometry = cloneDeep(EMPTY_GEO_JSON.features[destinationFeatureNr].geometry);
    dispatch(drawActions.setGeoJSON(newGeoJson));
    newList[0].geojson = newGeoJson;

    this.setState({ list: newList });
    // TODO: call reducer to update redux state
  }

  handleActionClick (action, sigmetPart) {
    const { dispatch, mapActions, drawActions } = this.props;

    switch (action) {
      case 'select-point':
        dispatch(mapActions.setMapMode('draw'));
        dispatch(drawActions.setFeatureEditPoint());
        break;
      case 'select-region':
        dispatch(mapActions.setMapMode('draw'));
        dispatch(drawActions.setFeatureEditBox());
        break;
      case 'select-shape':
        dispatch(mapActions.setMapMode('draw'));
        dispatch(drawActions.setFeatureEditPolygon());
        break;
      case 'select-fir':
        this.selectFir(sigmetPart === 'where' ? 0 : 1).then(() => {
          dispatch(mapActions.setMapMode('pan'));
          dispatch(drawActions.setFeatureEditPolygon());
        });
        break;
      case 'delete-selection':
        dispatch(mapActions.setMapMode('delete'));
        this.deleteDrawing(sigmetPart === 'where' ? 0 : 1);
        break;
      default:
        console.error(`Selection method ${action} unknown and not implemented`);
    }

    if (sigmetPart === 'where') dispatch(drawActions.setFeatureNr(0));
    if (sigmetPart === 'progress') dispatch(drawActions.setFeatureNr(1));
  }

  onObsOrFcstClick (obsSelected) {
    const newList = cloneDeep(this.state.list);
    newList[0].obs_or_forecast.obs = obsSelected;
    this.setState({ list: newList });
  }

  saveSigmet (evt) {
    evt.preventDefault();
    const newList = cloneDeep(this.state.list);
    newList[0].geojson = this.props.drawProperties.adagucMapDraw.geojson;
    this.setState({ list: newList });
    axios({
      method: 'post',
      url: this.props.source,
      withCredentials: true,
      responseType: 'json',
      data: newList[0]
    }).then(src => {
      this.savedSigmetCallback(src);
    }).catch(error => {
      this.couldntSaveSigmetCallback(error.response);
    });
  }

  cancelSigmet (uuid) {
    const { urls } = this.props;
    axios({
      method: 'post',
      url: urls.BACKEND_SERVER_URL + '/sigmet/cancelsigmet?uuid=' + uuid,
      withCredentials: true
    }).then((src) => {
      this.props.updateAllComponents();
    });
  }

  publishSigmet (uuid) {
    const { urls } = this.props;

    axios({
      method: 'post',
      url: urls.BACKEND_SERVER_URL + '/sigmet/publishsigmet?uuid=' + uuid,
      withCredentials: true
    }).then((src) => {
      this.props.updateAllComponents();
    });
  }
  setSelectedPhenomenon (phenomenonList) {
    if (phenomenonList.length === 0) {
      return;
    }
    const onlyObj = phenomenonList[0];
    let listCpy = cloneDeep(this.state.list);
    listCpy[0].phenomenon = onlyObj.code;
    this.setState({ list: listCpy });
    /* TODO
      const preset = this.sigmetLayers(onlyObj.layerpreset);
      this.props.dispatch(this.props.panelsActions.setPanelLayout(preset.display.type));
      this.props.dispatch(this.props.panelsActions.setPresetLayers(preset.panelsProperties));
      this.props.dispatch(this.props.mapActions.setCut({ name: 'Custom', bbox: [preset.area.left || 570875, preset.area.bottom, preset.area.right || 570875, preset.area.top] }));
    */
  }

  setSelectedFir (firList) {
    let firObj;
    if (firList.length === 0) {
      firObj = { firname: null, location_indicator_icao: null };
    } else {
      firObj = firList[0];
    }
    let listCpy = cloneDeep(this.state.list);
    listCpy[0].firname = firObj.firname;
    listCpy[0].location_indicator_icao = firObj.location_indicator_icao;
    this.setState({ list: listCpy });
  }

  setSelectedObservedForecast (isObserved) {
    let listCpy = cloneDeep(this.state.list);
    listCpy[0].obs_or_forecast = { obs: isObserved };
    this.setState({ list: listCpy });
  }

  setSelectedForecastPosition (forecastPosition) {
    let listCpy = cloneDeep(this.state.list);
    listCpy[0].forecast_position = forecastPosition.utc().format();
    this.setState({ list: listCpy });
  }

  setSelectedValidFromMoment (validFrom) {
    let listCpy = cloneDeep(this.state.list);
    listCpy[0].validdate = validFrom.utc().format();
    this.setState({ list: listCpy });
  }

  setSelectedValidUntilMoment (validUntil) {
    let listCpy = cloneDeep(this.state.list);
    listCpy[0].validdate_end = validUntil.utc().format();
    this.setState({ list: listCpy });
  }

  setSelectedMovement (evt) {
    const isStationary = !evt.target.checked;
    let listCpy = cloneDeep(this.state.list);
    listCpy[0].movement.stationary = isStationary;
    this.setState({ list: listCpy });
  }

  setSetMovementType (evt) {
    const isDefinedByArea = !evt.target.checked;
    let listCpy = cloneDeep(this.state.list);
    listCpy[0].movement.movementtype = isDefinedByArea;
    this.setState({ list: listCpy });
  }

  setSelectedDirection (dir) {
    if (Array.isArray(dir) && dir.length === 1) {
      const direction = dir[0].shortName;
      let listCpy = cloneDeep(this.state.list);
      listCpy[0].movement.dir = direction;
      this.setState({ list: listCpy });
    }
  }

  setSpeed (evt) {
    if (!isNaN(evt.target.value)) {
      const speed = evt.target.value;
      let listCpy = cloneDeep(this.state.list);
      listCpy[0].movement.speed = speed;
      this.setState({ list: listCpy });
    }
  }

  setChange (chg) {
    if (Array.isArray(chg) && chg.length === 1) {
      const change = chg[0].shortName;
      let listCpy = cloneDeep(this.state.list);
      listCpy[0].change = change;
      this.setState({ list: listCpy });
    }
  }

  getExistingSigmets () {
    axios({
      method: 'get',
      url: this.props.source,
      withCredentials: true,
      responseType: 'json'
    }).then(src => {
      this.gotExistingSigmetsCallback(src);
    }).catch(error => {
      this.gotExistingSigmetsCallback(error.response);
    });
  }

  setEmptySigmet () {
    this.setState({ list: [EMPTY_SIGMET] });
  }

  gotExistingSigmetsCallback (message) {
    let sigmetsList = message && message.data && message.data.sigmets ? message.data.sigmets : [];
    sigmetsList.forEach((sigmet) => {
      sigmet.phenomenonHRT = this.getHRT4code(sigmet.phenomenon);
    });
    this.setState({ list: sigmetsList });
  }

  savedSigmetCallback (message) {
    this.props.toggleMethod(null, 'concept-sigmets');
    this.props.selectMethod(0, this.state.list[0].geojson, 'concept-sigmets');

    this.setState({ isOpen: false, list: [EMPTY_SIGMET] });
    this.props.updateAllComponents();
  }

  couldntSaveSigmetCallback (message) {
    console.error('Error while trying to save SIGMET', message);
    if (this.props.selectedIndex === 0) {
      this.props.selectMethod(0);
    }
  }

  componentWillMount () {
    if (this.props.editable) {
      this.setEmptySigmet();
    } else {
      this.getExistingSigmets(this.props.source);
    }
  }

  componentWillReceiveProps (nextProps) {
    if (typeof nextProps.isOpen !== 'undefined') {
      this.setState({ isOpen: nextProps.isOpen });
    }
    if (typeof nextProps.isClosing !== 'undefined') {
      this.setState({ isClosing: nextProps.isClosing });
    }
    if (nextProps.hasOwnProperty('drawProperties') && typeof nextProps.drawProperties === 'object' &&
        nextProps.drawProperties.hasOwnProperty('adagucMapDraw') &&
        nextProps.drawProperties.adagucMapDraw.hasOwnProperty('geojson') && nextProps.drawProperties.adagucMapDraw.geojson &&
        !isEqual(nextProps.drawProperties.adagucMapDraw.geojson, EMPTY_GEO_JSON) &&
        Array.isArray(this.state.list) && this.state.list.length > 0) {
      const newList = cloneDeep(this.state.list);
      newList[0].geojson = this.props.drawProperties.adagucMapDraw.geojson;
      this.setState({ list: newList });
    }
    if (this.props.editable && Array.isArray(this.state.list) && this.state.list.length > 0 &&
        this.state.list[0].validdate) {
      const curVal = moment(this.state.list[0].validdate).utc();
      const nowVal = moment().utc();
      if (curVal.isBefore(nowVal, 'minute')) {
        const newList = update(this.state.list, {
          0: {
            validdate: { $set: nowVal.format() }
          }
        });
        this.setState({ list: newList });
      }
    }
  }

  componentWillUpdate (nextProps) {
    if (this.props.latestUpdateTime !== nextProps.latestUpdateTime && this.props.isGetType === true) {
      this.getExistingSigmets(this.props.source);
    }
  }

  marks (values) {
    const retObj = {};
    values.map((val) => {
      if (val < 50) {
        if (this.state.lowerUnit === UNITS_ALT.FT) {
          retObj[val] = parseInt(val * 100) + ' ' + UNITS_ALT.FT;
        } else {
          retObj[val] = parseInt(Math.round(val * 30.48)) + ' ' + UNITS_ALT.M;
        }
      } else {
        // 50 = a * 50 + b   \
        //                    -> y = 7 * x - 300
        // 400 = a * 100 + b /
        retObj[val] = UNITS_ALT.FL + Math.round(7 * val - 300);
      }
    });

    retObj[0] = 'Surface';
    retObj[100] = 'Above';

    return retObj;
  };

  tooltip (height) {
    if (height === 100) {
      return 'Above';
    }
    if (height === 0) {
      return 'Surface';
    }

    if (height < 50) {
      if (this.state.lowerUnit === UNITS_ALT.FT) {
        return parseInt(height * 100) + ' ' + UNITS_ALT.FT;
      } else {
        return parseInt(Math.round(height * 30.48)) + ' ' + UNITS_ALT.M;
      }
    } else {
      return UNITS_ALT.FL + Math.round(7 * height - 300);
    }
  };

  showLevels (level) {
    if (!level.lev1) {
      return '';
    }
    let result = '';
    switch (level.lev1.unit) {
      case 'SFC':
        if (!level.lev2) {
          return '';
        }
        result = 'Between surface and ';
        if (level.lev2.unit === UNITS_ALT.FL) {
          result += UNITS_ALT.FL + level.lev2.value;
        } else {
          result += level.lev2.value + level.lev2.unit === UNITS_ALT.M ? 'm' : 'ft';
        }
        return result;
      case 'TOP':
        return 'Tops at FL' + level.lev1.value;
      case 'TOP_ABV':
        return 'Tops above FL' + level.lev1.value;
      case 'ABV':
        return 'Above FL' + level.lev1.value;
    }

    if (!level.lev2) {
      let result = 'At ';
      if (level.lev1.unit === UNITS_ALT.FL) {
        result += 'FL' + level.lev1.value;
      } else {
        result += level.lev1.value + level.lev1.unit === UNITS_ALT.M ? 'm' : 'ft';
      }
      return result;
    } else {
      let result = 'Between ';
      if (level.lev1.unit === UNITS_ALT.FL) {
        result += 'FL' + level.lev1.value + ' and FL' + level.lev2.value;
      } else if (level.lev1.unit === UNITS_ALT.M) {
        result += level.lev1.value + 'm and ' + level.lev2.value + 'm';
      } else {
        result += level.lev1.value + 'ft and ' + level.lev2.value + 'ft';
      }
      return result;
    }
  }

  setTops (evt) {
    let newPartialState = { tops: evt.target.checked };
    if (newPartialState.tops) {
      newPartialState['lowerUnit'] = UNITS_ALT.FL;
    }
    this.setState(newPartialState);
  }

  setSigmetLevel (value) {
    let listCpy = cloneDeep(this.state.list);
    if (value.length === 0) {
      return;
    }
    if (value.length === 1) {
      // Slider was used
      const val = value[0];
      const isTop = this.state.tops;
      if (isTop) {
        listCpy[0].level.lev1 = { unit: 'TOP', value: val };
      } else {
        switch (this.state.lowerUnit) {
          case UNITS_ALT.M:
            const meterVal = Math.round((val * 30.48) / 100) * 100;
            listCpy[0].level.lev1 = { unit: 'M', value: meterVal };
            break;
          case UNITS_ALT.FT:
            const feetVal = val * 100;
            listCpy[0].level.lev1 = { unit: 'FT', value: feetVal };
            break;
          case UNITS_ALT.FL:
          default:
            listCpy[0].level.lev1 = { unit: 'FL', value: val };
            break;
        }
      }
    } else {
      // value.length === 2
      const lowerVal = value[0];
      const upperVal = value[1];
      if (lowerVal >= upperVal) {
        return;
      }
      if (lowerVal === 0) {
        // SFC
        listCpy[0].level.lev1 = { unit: 'SFC', value: 0 };
        switch (this.state.lowerUnit) {
          case UNITS_ALT.M:
            const meterVal = Math.round((lowerVal * 30.48) / 100) * 100;
            listCpy[0].level.lev2 = { unit: 'M', value: meterVal };
            break;
          case UNITS_ALT.FT:
            const feetVal = lowerVal * 100;
            listCpy[0].level.lev2 = { unit: 'FT', value: feetVal };
            break;
          case UNITS_ALT.FL:
          default:
            listCpy[0].level.lev2 = { unit: 'FL', value: lowerVal };
            break;
        }
      } else if (upperVal === 400) {
        // Above
        listCpy[0].level.lev1 = { unit: this.state.tops ? 'TOP_ABV' : 'ABV', value: 0 };
        switch (this.state.lowerUnit) {
          case UNITS_ALT.M:
            break;
          case UNITS_ALT.FT:
            break;
          case UNITS_ALT.FL:
          default:
            listCpy[0].level.lev2 = { unit: 'FL', value: lowerVal };
            break;
        }
      } else {
        // Between
        switch (this.state.lowerUnit) {
          case UNITS_ALT.M:
            const lowerMeterVal = Math.round((lowerVal * 30.48) / 100) * 100;
            const upperMeterVal = Math.round((upperVal * 30.48) / 100) * 100;
            listCpy[0].level.lev1 = { unit: 'M', value: lowerMeterVal };
            listCpy[0].level.lev2 = { unit: 'M', value: upperMeterVal };
            break;
          case UNITS_ALT.FT:
            const lowerFeetVal = lowerVal * 100;
            const upperFeetVal = upperVal * 100;
            listCpy[0].level.lev1 = { unit: 'FT', value: lowerFeetVal };
            listCpy[0].level.lev2 = { unit: 'FT', value: upperFeetVal };
            break;
          case UNITS_ALT.FL:
          default:
            listCpy[0].level.lev1 = { unit: 'FL', value: lowerVal };
            listCpy[0].level.lev2 = { unit: 'FL', value: upperVal };
            break;
        }
      }
    }
    this.setState({ list: listCpy });
  }

  renderLevelSelection (editable, item) {
    const feetNumbers = range(0, 50, 10);
    const flNumbers = range(50, 100, 7.142857);
    const markValues = this.marks([...feetNumbers, ...flNumbers]);
    const handle = (params) => {
      const { value, dragging, index, ...restProps } = params;
      return (
        <Tooltip
          prefixCls='rc-slider-tooltip'
          overlay={this.tooltip(value, this.state.lowerUnit)}
          visible={dragging}
          placement='top'
          key={index}
        >
          <Handle {...restProps} />
        </Tooltip>
      );
    };

    if (editable) {
      return (<Row>
        <Col xs='9' style={{ flexDirection: 'column' }}>
          <Row />
          <Row />
          <Row>
            <Col xs={{ size: 3, offset: 1 }}>
              <Badge>Tops</Badge>
            </Col>
            <Col xs='8' style={{ justifyContent: 'center' }}>
              <SwitchButton id='topswitch' name='topswitch' labelLeft='Off' labelRight='On&nbsp;' isChecked={this.state.tops} action={(evt) => this.setTops(evt)} align='center' />
            </Col>
          </Row>
          <Row>
            <Col xs={{ size: 3, offset: 1 }}>
              <Badge>Levels</Badge>
            </Col>
            <Col xs='8' style={{ justifyContent: 'center' }}>
              <SwitchButton id='dualsingleswitch' name='dualsingleswitch' labelRight='Extent' labelLeft='Single'
                isChecked={this.state.renderRange} action={(evt) => this.setState({ renderRange: evt.target.checked })} align='center' />
            </Col>
          </Row>
          <Row style={{ flex: 'none', padding: '0.5rem 0' }}>
            <Col xs={{ size: 3, offset: 1 }}>
              <Badge>Units</Badge>
            </Col>
            <Col xs={{ size: 6, offset: 1 }} style={{ justifyContent: 'center' }}>
              <ButtonGroup>
                <Button color='primary' onClick={() => this.setState({ lowerUnit: UNITS_ALT.FT })} active={this.state.lowerUnit === UNITS_ALT.FT}
                  disabled={this.state.tops}>{`${UNITS_ALT.FT}/${UNITS_ALT.FL}`}</Button>
                <Button color='primary' onClick={() => this.setState({ lowerUnit: UNITS_ALT.M })} active={this.state.lowerUnit === UNITS_ALT.M}
                  disabled={this.state.tops}>{`${UNITS_ALT.M}/${UNITS_ALT.FL}`}</Button>
              </ButtonGroup>
            </Col>
          </Row>

          <Row />
        </Col>
        <Col xs='3'>
          <Row style={{ padding: '1rem 0' }}>
            {this.state.renderRange
              ? <Range step={0.5} allowCross={false} min={0} max={100} marks={markValues} vertical
                onChange={(v) => this.setSigmetLevel(v)} tipFormatter={value => this.tooltip(value, this.state.lowerUnit)} />
              : <Slider step={0.5} allowCross={false} min={0} max={100} marks={markValues} vertical onChange={(v) => this.setSigmetLevel([v])} handle={handle} />
            }
          </Row>
        </Col>
      </Row>);
    }
    return (<Col>
      {this.showLevels(item.level)}
    </Col>);
  }

  render () {
    const { title, icon, parentCollapsed, editable, selectedIndex, toggleMethod, scrollAction, drawProperties } = this.props;
    const notifications = !editable ? this.state.list.length : 0;
    // Show a warning in case there is no drawing yet, so both the this.state.list and the this.props.drawProperties are empty
    const showDrawWarningFromState = !this.state.list.length > 0 || !this.state.list[0].hasOwnProperty('geojson') || !this.state.list[0].geojson.hasOwnProperty('features') ||
      !this.state.list[0].geojson.features.length > 0 || !this.state.list[0].geojson.features[0].hasOwnProperty('geometry') ||
      !this.state.list[0].geojson.features[0].geometry.hasOwnProperty('coordinates') || !this.state.list[0].geojson.features[0].geometry.coordinates.length > 0;
    const showDrawWarningFromProps = !drawProperties || !drawProperties.hasOwnProperty('geojson') || !drawProperties.adagucMapDraw.geojson.hasOwnProperty('features') ||
      !drawProperties.adagucMapDraw.geojson.features.length > 0 || !drawProperties.adagucMapDraw.geojson.features[0].hasOwnProperty('geometry') ||
      !drawProperties.adagucMapDraw.geojson.features[0].geometry.hasOwnProperty('coordinates') || !drawProperties.adagucMapDraw.geojson.features[0].geometry.coordinates.length > 0;
    let maxSize = this.state.list ? 550 * this.state.list.slice(0, 5).length : 0;
    if (editable) {
      maxSize = 1020;
    }
    const sourceless = Object.keys(this.props.sources || {}).length === 0;
    const now = moment().utc();
    const availablePhenomena = this.getPhenomena();
    const availableFirs = this.getParameters().firareas;
    const drawActions = [
      /* {
        title: 'Select point',
        action: 'select-point',
        icon: 'circle'
      }, */
      {
        title: 'Select region',
        action: 'select-region',
        icon: 'retweet'
      },
      {
        title: 'Select shape',
        action: 'select-shape',
        icon: 'pencil'
      },
      {
        title: 'Select entire FIR',
        action: 'select-fir',
        icon: 'globe'
      },
      {
        title: 'Delete selection',
        action: 'delete-selection',
        icon: 'trash'
      }
    ];

    return (
      <Card className='row accordion' style={{ flex: (this.state.isOpen || this.state.isClosing) ? 'auto' : null, minWidth: 0, flexWrap: 'nowrap' }}>
        {parentCollapsed
          ? <CardHeader className='row' style={{ minHeight: '2.5rem' }}>
            <Col xs='auto'>
              <Icon name={icon} />
            </Col>
            <Col xs='auto'>&nbsp;</Col>
            <Col xs='auto'>
              {notifications > 0 ? <Badge color='danger' pill className='collapsed'>{notifications}</Badge> : null}
            </Col>
          </CardHeader>
          : <CardHeader onClick={maxSize > 0 ? toggleMethod : null} className={maxSize > 0 ? 'row' : 'row disabled'} title={title} style={{ minHeight: '2.5rem' }}>
            <Col xs='auto'>
              <Icon name={icon} />
            </Col>
            <Col style={{ marginLeft: '0.9rem' }}>
              {title}
            </Col>
            <Col xs='auto'>
              {notifications > 0 ? <Badge color='danger' pill>{notifications}</Badge> : null}
            </Col>
          </CardHeader>
        }
        <Row style={{ flex: 'auto', overflowY: 'auto' }} onScroll={scrollAction}>
          <CollapseOmni className='CollapseOmni col' isOpen={this.state.isOpen} minSize={0} maxSize={maxSize}>
            <CardBlock>
              {(this.state.isOpen || this.state.isClosing)
                ? <Row>
                  <Col className='btn-group-vertical' style={{ minWidth: 0, flexGrow: 1, minHeight: maxSize }}>
                    {this.state.list.slice(0, 5).map((item, index) => {
                      const selectedPhenomenon = availablePhenomena.filter((ph) => ph.code === item.phenomenon).shift();
                      const selectedFir = availableFirs.filter((fr) => fr.firname === item.firname).shift();
                      const selectedDirection = DIRECTIONS.filter((dr) => dr.shortName === item.movement.dir).shift();
                      const selectedChange = CHANGES.filter((ch) => ch.shortName === item.change).shift();
                      let { issuedate } = item;
                      issuedate = issuedate || 'Not yet issued';
                      if (item.cancels) {
                        return <Button tag='div' className={'Sigmet row' + (selectedIndex === index ? ' active' : '')}
                          key={index} onClick={(evt) => { this.handleSigmetClick(evt, index); }} title={item.phenomenonHRT} >
                          <Row>
                            <Col xs='3'>
                              <Badge color='success'>What</Badge>
                            </Col>
                            <Col xs='9'>
                              Cancellation of SIGMET {item.cancels}
                            </Col>
                          </Row>
                          <Row style={{ paddingTop: '0.19rem' }}>
                            <Col xs={{ size: 2, offset: 1 }}>
                              <Badge>At</Badge>
                            </Col>
                            <Col xs='9'>
                              {
                                issuedate === 'Not yet issued'
                                  ? <span>{issuedate}</span>
                                  : <Moment format={DATE_TIME_FORMAT} date={issuedate} />
                              }
                            </Col>
                          </Row>

                          <Row className='section' style={{ minHeight: '1.75rem' }}>
                            <Col xs='3'>
                              <Badge color='success'>Valid</Badge>
                            </Col>
                          </Row>
                          <Row style={{ paddingTop: '0.19rem' }}>
                            <Col xs={{ size: 2, offset: 1 }}>
                              <Badge>From</Badge>
                            </Col>
                            <Col xs='9'>
                              <Moment format={DATE_TIME_FORMAT} date={item.validdate} />
                            </Col>
                          </Row>
                          <Row style={{ paddingTop: '0.19rem' }}>
                            <Col xs={{ size: 2, offset: 1 }}>
                              <Badge>Until</Badge>
                            </Col>
                            <Col xs='9'>
                              <Moment format={DATE_TIME_FORMAT} date={item.validdate_end} />
                            </Col>
                          </Row>
                          <Row className='section' style={editable ? { minHeight: '2.5rem' } : null}>
                            <Col xs='3'>
                              <Badge color='success'>Where</Badge>
                            </Col>
                            <Col xs='9'>
                              <span>{item.firname || 'no firname provided yet'}</span>
                            </Col>
                          </Row>
                          <Row style={editable ? { minHeight: '2.5rem' } : null}>
                            <Col xs={{ size: 9, offset: 3 }}>
                              {item.location_indicator_icao}
                            </Col>
                          </Row>
                          <Row>
                            <Col xs={{ size: 2, offset: 1 }}>
                              <Badge>Sequence</Badge>
                            </Col>
                            <Col xs='6'>
                              {(!isNaN(item.sequence) && item.sequence !== -1) ? item.sequence : '(not yet published)'}
                            </Col>
                          </Row>
                          <Row />
                        </Button>;
                      }
                      return <Button tag='div' className={'Sigmet row' + (selectedIndex === index ? ' active' : '')}
                        key={index} onClick={(evt) => { this.handleSigmetClick(evt, index); }} title={item.phenomenonHRT} >
                        <Row style={editable ? { minHeight: '2rem' } : null}>
                          <Col xs='3'>
                            <Badge color='success'>What</Badge>
                          </Col>
                          <Col xs='9'>
                            {editable
                              ? <Typeahead disabled={sourceless} filterBy={['name', 'code']} labelKey='code'
                                options={availablePhenomena} placeholder={sourceless ? 'Loading phenomena ⏳' : 'Select phenomenon'}
                                onChange={(phenomenonList) => this.setSelectedPhenomenon(phenomenonList)}
                                selected={selectedPhenomenon ? [selectedPhenomenon] : []}
                                clearButton />
                              : <span style={{ fontWeight: 'bold' }}>{item.phenomenon}</span>
                            }
                          </Col>
                        </Row>
                        <Row style={editable ? { marginTop: '0.19rem', minHeight: '2rem' } : null}>
                          <Col xs={{ size: 9, offset: 3 }}>
                            {editable
                              ? <SwitchButton id='obsfcstswitch' name='obsfcstswitch'
                                labelRight='Observed' labelLeft='Forecast' isChecked={item.obs_or_forecast.obs} action={(evt) => this.setSelectedObservedForecast(evt.target.checked)} />
                              : <span>{item.obs_or_forecast.obs ? 'Observed' : 'Forecast'}</span>
                            }
                          </Col>
                        </Row>
                        <Row style={editable ? { paddingTop: '0.19rem', minHeight: '2rem' } : { paddingTop: '0.19rem' }}>
                          <Col xs={{ size: 2, offset: 1 }}>
                            <Badge>At</Badge>
                          </Col>
                          <Col xs='9'>
                            {editable
                              ? <DateTimePicker style={{ width: '100%' }} dateFormat={DATE_FORMAT} timeFormat={TIME_FORMAT} utc
                                onChange={(at) => this.setSelectedForecastPosition(at)}
                                inputProps={item.obs_or_forecast.obs ? { disabled: true } : null}
                                isValidDate={(curr, selected) => curr.isAfter(now.subtract(1, 'day')) &&
                                  curr.isBefore(now.add(this.getParameters().hoursbeforevalidity, 'hour'))}
                                timeConstraints={{
                                  hours: {
                                    min: now.hour(),
                                    max: (now.hour() + this.getParameters().hoursbeforevalidity)
                                  }
                                }}
                                viewMode='time'
                                value={item.forecast_position ? moment.utc(item.forecast_position) : now}
                              />
                              : (issuedate === 'Not yet issued'
                                ? <span>{issuedate}</span>
                                : <Moment format={DATE_TIME_FORMAT} date={issuedate} />)
                            }
                          </Col>
                        </Row>
                        <Row className='section' style={{ minHeight: '1.75rem' }}>
                          <Col xs='3'>
                            <Badge color='success'>Valid</Badge>
                          </Col>
                        </Row>
                        <Row style={editable ? { paddingTop: '0.19rem', minHeight: '2rem' } : { paddingTop: '0.19rem' }}>
                          <Col xs={{ size: 2, offset: 1 }}>
                            <Badge>From</Badge>
                          </Col>
                          <Col xs='9'>
                            {editable
                              ? <DateTimePicker style={{ width: '100%' }} dateFormat={DATE_FORMAT} timeFormat={TIME_FORMAT} utc
                                onChange={(validFrom) => this.setSelectedValidFromMoment(validFrom)}
                                isValidDate={(curr, selected) => curr.isAfter(now.subtract(1, 'day')) &&
                                  curr.isBefore(now.add(this.getParameters().hoursbeforevalidity, 'hour'))}
                                timeConstraints={{
                                  hours: {
                                    min: now.hour(),
                                    max: (now.hour() + this.getParameters().hoursbeforevalidity)
                                  }
                                }}
                                viewMode='time'
                                value={moment.utc(item.validdate) || now}
                              />
                              : <Moment format={DATE_TIME_FORMAT} date={item.validdate} />
                            }
                          </Col>
                        </Row>
                        <Row style={editable ? { paddingTop: '0.19rem', minHeight: '2.5rem' } : { paddingTop: '0.19rem' }}>
                          <Col xs={{ size: 2, offset: 1 }}>
                            <Badge>Until</Badge>
                          </Col>
                          <Col xs='9'>
                            {editable
                              ? <DateTimePicker style={{ width: '100%' }} dateFormat={DATE_FORMAT} timeFormat={TIME_FORMAT} utc
                                onChange={(validUntil) => this.setSelectedValidUntilMoment(validUntil)}
                                isValidDate={(curr, selected) => curr.isAfter(moment.utc(item.validdate).subtract(1, 'day')) &&
                                  curr.isBefore(moment.utc(item.validdate).add(this.getParameters().maxhoursofvalidity, 'hour'))}
                                timeConstraints={{
                                  hours: {
                                    min: moment.utc(item.validdate).hour(),
                                    max: (moment.utc(item.validdate).hour() + this.getParameters().maxhoursofvalidity)
                                  }
                                }}
                                viewMode='time'
                                value={moment.utc(item.validdate_end) || moment.utc(item.validdate).add(this.getParameters().maxhoursofvalidity, 'hour')} />
                              : <Moment format={DATE_TIME_FORMAT} date={item.validdate_end} />
                            }
                          </Col>
                        </Row>
                        <Row className='section' style={editable ? { minHeight: '2.5rem' } : null}>
                          <Col xs='3'>
                            <Badge color='success'>Where</Badge>
                          </Col>
                          <Col xs='9'>
                            {editable
                              ? <Typeahead style={{ width: '100%' }} filterBy={['firname', 'location_indicator_icao']} labelKey='firname'
                                options={availableFirs} onChange={(firList) => this.setSelectedFir(firList)}
                                selected={selectedFir ? [selectedFir] : []} placeholder={'Select FIR'}
                                clearButton />
                              : <span>{item.firname || 'no firname provided yet'}</span>
                            }
                          </Col>
                        </Row>
                        <Row style={editable ? { minHeight: '2.5rem' } : null}>
                          <Col xs={{ size: 9, offset: 3 }}>
                            {item.location_indicator_icao}
                          </Col>
                        </Row>
                        {editable
                          ? <Row className='section' style={{ minHeight: '3.685rem', marginBottom: '0.33rem' }}>
                            {drawActions.map((actionItem, index) =>
                              <Col xs={{ size: 'auto', offset: index === 0 ? 3 : null }} key={index} style={{ padding: '0 0.167rem' }}>
                                <Button color='primary' active={actionItem.action === 'mapProperties.mapMode'} disabled={actionItem.disabled || null}
                                  id={actionItem.action + '_button'} title={actionItem.title} onClick={() => this.handleActionClick(actionItem.action, 'where')} style={{ width: '3rem' }}>
                                  <Icon name={actionItem.icon} />
                                </Button>
                              </Col>)
                            }
                          </Row>
                          : ''
                        }
                        {selectedIndex > -1 && editable && (showDrawWarningFromState && showDrawWarningFromProps)
                          ? <Row style={{ flex: 'none', padding: '0.5rem 0 0.5rem 0.12rem', maxWidth: '28.7rem' }}>
                            <Col>
                              <Alert color='danger' style={{ display: 'block', margin: '0', whiteSpace: 'normal', padding: '0.75rem' }}>
                                Please use one of the selection tools above to indicate on the map where the phenomenon is
                                {item.obs_or_forecast.obs ? ' observed.' : ' expected to occur.'}
                              </Alert>
                            </Col>
                          </Row>
                          : ''
                        }
                        <Row className='section' style={editable ? { minHeight: '14rem' } : null}>
                          <Col xs={editable ? { size: 12 } : { size: 9, offset: 3 }}>
                            {this.renderLevelSelection(editable, item)}
                          </Col>
                        </Row>
                        <Row className='section' style={{ minHeight: '2.5rem' }}>
                          <Col xs='3'>
                            <Badge color='success'>Progress</Badge>
                          </Col>
                          <Col xs='9' style={{ justifyContent: 'center' }}>
                            {/* dir: {N,NNE,NE,ENE,E,ESE,SE,SSE,S,SSW,SW,WSW,W,WNW} */}
                            {/* speed: int */}
                            {editable
                              ? <SwitchButton id='movementswitch' name='movementswitch'
                                labelRight='Move' labelLeft='Stationary' isChecked={!item.movement.stationary} action={this.setSelectedMovement} />
                              : <span>{item.movement.stationary ? 'Stationary' : 'Move'}</span>
                            }

                          </Col>
                        </Row>
                        <Row className='section' style={{ minHeight: '2.5rem' }}>
                          <Col xs='3'>
                            <Badge color='success'>Type</Badge>
                          </Col>
                          <Col xs='9' style={{ justifyContent: 'center' }}>
                            {/* dir: {N,NNE,NE,ENE,E,ESE,SE,SSE,S,SSW,SW,WSW,W,WNW} */}
                            {/* speed: int */}
                            {editable
                              ? <SwitchButton id='movementtypeswitch' name='movementtypeswitch'
                                labelLeft='By area' labelRight='By speed and direction' isChecked={item.movement.movementtype === false} action={this.setSetMovementType} />
                              : <span>{!item.movement.movementtype ? 'Movement defined by area' : 'Movement defined with speed and direction'}</span>
                            }

                          </Col>
                        </Row>
                        {editable
                          ? <Row className='section' style={{ minHeight: '3.685rem', marginBottom: '0.33rem' }}>
                            {drawActions.map((actionItem, index) =>
                              <Col xs={{ size: 'auto', offset: index === 0 ? 3 : null }} key={index} style={{ padding: '0 0.167rem' }}>
                                <Button color='primary' active={actionItem.action === 'mapProperties.mapMode'}
                                  disabled={!item.movement.movementtype || item.movement.stationary || actionItem.disabled || null}
                                  id={actionItem.action + '_button'} title={actionItem.title} onClick={() => this.handleActionClick(actionItem.action, 'progress')} style={{ width: '3rem' }}>
                                  <Icon name={actionItem.icon} />
                                </Button>
                              </Col>)
                            }
                          </Row>
                          : ''
                        }
                        <Row style={editable ? { marginTop: '0.19rem', minHeight: '2rem' } : null}>
                          <Col xs={{ size: 2, offset: 1 }}>
                            <Badge title='Direction'>Direction</Badge>
                          </Col>
                          <Col xs='9'>
                            {editable
                              ? <Typeahead style={{ width: '100%' }} filterBy={['shortName', 'longName']} labelKey='longName'
                                disabled={item.movement.stationary || item.movement.movementtype}
                                options={DIRECTIONS} placeholder={item.movement.stationary ? null : 'Select direction'}
                                onChange={(dir) => this.setSelectedDirection(dir)}
                                selected={selectedDirection ? [selectedDirection] : []}
                                clearButton />
                              : <span>{selectedDirection ? selectedDirection.longName : (!item.movement.stationary ? 'No direction selected' : null)}</span>
                            }
                          </Col>
                        </Row>
                        <Row style={editable ? { marginTop: '0.19rem', minHeight: '2rem' } : null}>
                          <Col xs={{ size: 2, offset: 1 }}>
                            <Badge>Speed</Badge>
                          </Col>
                          <Col xs='9'>
                            {editable
                              ? <InputGroup>
                                <Input onChange={this.setSpeed} defaultValue='0' type='number' step='1' disabled={item.movement.stationary || item.movement.movementtype} />
                                <InputGroupAddon>KT</InputGroupAddon>
                              </InputGroup>
                              : <span>{item.movement.speed ? `${item.movement.speed} KT` : null }</span>
                            }
                          </Col>
                        </Row>
                        <Row className='section' style={editable ? { marginTop: '0.19rem', minHeight: '2.5rem' } : null}>
                          <Col xs='3'>
                            <Badge color='success'>Change</Badge>
                          </Col>
                          <Col xs='9'>
                            {editable
                              ? <Typeahead style={{ width: '100%' }} filterBy={['shortName', 'longName']} labelKey='longName'
                                options={CHANGES} placeholder={'Select change'}
                                onChange={(chg) => this.setChange(chg)}
                                selected={selectedChange ? [selectedChange] : []}
                                clearButton />
                              : <span>{selectedChange ? selectedChange.longName : 'No change selected'}</span>
                            }
                          </Col>
                        </Row>
                        <Row>
                          <Col xs={{ size: 9, offset: 3 }}>
                            {item.forecast_position}
                          </Col>
                        </Row>
                        <Row className='section' style={{ minHeight: '2.5rem' }}>
                          <Col xs='3'>
                            <Badge color='success'>Issued at</Badge>
                          </Col>
                          <Col xs='9'>
                            {editable
                              ? '(not yet published)'
                              : <Moment format={DATE_TIME_FORMAT} date={item.issuedate} />
                            }
                          </Col>
                        </Row>
                        <Row style={{ minHeight: '2.5rem' }}>
                          <Col xs={{ size: 9, offset: 3 }}>
                            {item.location_indicator_mwo}
                          </Col>
                        </Row>
                        {!editable
                          ? <Row>
                            <Col xs={{ size: 2, offset: 1 }}>
                              <Badge>Sequence</Badge>
                            </Col>
                            <Col xs='6'>
                              {(!isNaN(item.sequence) && item.sequence !== -1) ? item.sequence : '(not yet published)'}
                            </Col>
                          </Row>
                          : null
                        }
                        {editable
                          ? <Row className='section' style={{ minHeight: '3.185rem' }}>
                            <Col xs={{ size: 3, offset: 9 }}>
                              <Button color='primary' disabled={selectedIndex === -1} onClick={this.saveSigmet} >Create</Button>
                            </Col>
                          </Row>
                          : ''
                        }
                        {!editable
                          ? <Row className='section' style={{ minHeight: '3.185rem' }}>
                            <Col xs={{ size: 6, offset: 6 }}>
                              <Button style={{ marginRight: '0.33rem' }} disabled={item.status !== 'PUBLISHED'} color='primary' onClick={() => this.cancelSigmet(item.uuid)}>Cancel</Button>
                              <Button disabled={item.status === 'PUBLISHED'} color='primary' onClick={() => this.publishSigmet(item.uuid)}>Publish</Button>
                            </Col>
                          </Row>
                          : ''
                        }
                      </Button>;
                    })}
                  </Col>
                </Row>
                : null}
            </CardBlock>
          </CollapseOmni>
        </Row>
      </Card>);
  }
}

SigmetCategory.defaultProps = {
  isOpen: false,
  isClosing: false,
  editable: false,
  selectedIndex: 0,
  selectMethod: () => {},
  toggleMethod: () => {},
  parentCollapsed: false,
  phenomenonMapping: [],
  dispatch: () => {},
  updateParent: () => {},
  scrollAction: () => {}
};

SigmetCategory.propTypes = {
  isOpen: PropTypes.bool,
  isClosing: PropTypes.bool,
  title: PropTypes.string.isRequired,
  icon: PropTypes.string,
  source: PropTypes.string,
  editable: PropTypes.bool,
  selectedIndex: PropTypes.number,
  selectMethod: PropTypes.func,
  toggleMethod: PropTypes.func,
  parameters: PropTypes.object,
  parentCollapsed: PropTypes.bool,
  adagucProperties: PropTypes.object,
  phenomenonMapping: PropTypes.array,
  dispatch: PropTypes.func,
  actions: PropTypes.object,
  updateParent: PropTypes.func,
  mapActions: PropTypes.object,
  drawActions: PropTypes.object,
  panelsActions: PropTypes.object,
  drawProperties: PropTypes.shape({
    adagucMapDraw: {
      geojson: PropTypes.object
    }
  }),
  sources: PropTypes.object,
  latestUpdateTime: PropTypes.string,
  updateAllComponents: PropTypes.func,
  isGetType: PropTypes.bool,
  scrollAction: PropTypes.func,
  urls: PropTypes.arrayOf(PropTypes.string)
};

export default SigmetCategory;
