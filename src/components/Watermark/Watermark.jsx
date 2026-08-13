import { memo } from 'react';
import { useApp } from '../../context/AppContext';
import styles from './Watermark.module.css';
import logo from '../../assets/zixovibes-logo.png';

const Watermark = memo(function Watermark() {
  const { notebookOpen, mode } = useApp();
  const isDimmed = mode === 'deepfocus' && notebookOpen;

  return (
    <div className={`${styles.watermark} ${isDimmed ? styles.dimmed : ''}`} aria-hidden="true">
      <img src={logo} alt="" className={styles.watermarkImg} draggable="false" />
    </div>
  );
});

export default Watermark;
