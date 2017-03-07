import TasksContainer from '../../../containers/TasksContainer';
import Inspector from '../../../components/Inspector';
import TitleBarContainer from '../../../containers/TitleBarContainer';
import { connect } from 'react-redux';

const mapStateToHeaderProps = (state) => {
  return {
    title: 'header',
    isLoggedIn: false
  };
};

const mapStateToLeftSideBarProps = (state) => {
  return { title: 'leftSideBar SIGMET' };
};

const mapStateToMainViewportProps = (state) => {
  return { title: 'createSigmet SIGMET' };
};

const mapStateToRightSideBarProps = (state) => {
  return { title: 'rightSideBar SIGMET' };
};

// Sync route definition
export default () => ({
  path: 'createsigmet',
  title: 'CreateSigmet',
  components : {
    header: connect(mapStateToHeaderProps)(TitleBarContainer),
    leftSideBar: connect(mapStateToLeftSideBarProps)(Inspector),
    mainViewport: connect(mapStateToMainViewportProps)(TasksContainer),
    rightSideBar: connect(mapStateToRightSideBarProps)(Inspector)
  }
});
