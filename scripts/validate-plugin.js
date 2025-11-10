#!/usr/bin/env node

/**
 * Orca Plugin Structure Validator
 * Validates that the plugin has the required structure and metadata
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 Validating Orca plugin structure...');

try {
  // Check required files
  const requiredFiles = [
    'dist/index.js',
    'icon.png',
    'package.json'
  ];

  let allFilesExist = true;

  requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      console.error(`❌ Missing required file: ${file}`);
      allFilesExist = false;
    } else {
      console.log(`✅ ${file} exists`);
    }
  });

  if (!allFilesExist) {
    process.exit(1);
  }

  // Validate package.json structure
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  // Check required fields
  const requiredFields = ['name', 'version', 'description'];
  requiredFields.forEach(field => {
    if (!packageJson[field]) {
      console.error(`❌ Missing required package.json field: ${field}`);
      process.exit(1);
    } else {
      console.log(`✅ package.json.${field}: ${packageJson[field]}`);
    }
  });

  // Check orca plugin metadata
  if (!packageJson.orca) {
    console.error('❌ Missing orca plugin metadata in package.json');
    process.exit(1);
  }

  const orcaMetadata = packageJson.orca;
  const requiredOrcaFields = ['displayName', 'description', 'version', 'category'];

  requiredOrcaFields.forEach(field => {
    if (!orcaMetadata[field]) {
      console.error(`❌ Missing required orca metadata field: ${field}`);
      process.exit(1);
    } else {
      console.log(`✅ orca.${field}: ${orcaMetadata[field]}`);
    }
  });

  // Check if dist/index.js has expected content
  if (fs.existsSync('dist/index.js')) {
    const distContent = fs.readFileSync('dist/index.js', 'utf8');

    // Look for key identifiers from our plugin
    const expectedContent = [
      'orca-icon-cache-v3',
      'orca-dynamic-icon',
      '__ORCA_ICON_REPLACER'
    ];

    expectedContent.forEach(content => {
      if (distContent.includes(content)) {
        console.log(`✅ Found expected content: ${content}`);
      } else {
        console.error(`❌ Missing expected content: ${content}`);
        process.exit(1);
      }
    });
  }

  // Check file sizes
  if (fs.existsSync('dist/index.js')) {
    const stats = fs.statSync('dist/index.js');
    const sizeKB = Math.round(stats.size / 1024);

    if (sizeKB > 500) {
      console.warn(`⚠️  Large bundle size: ${sizeKB}KB (recommended: < 500KB)`);
    } else {
      console.log(`✅ Bundle size: ${sizeKB}KB`);
    }
  }

  if (fs.existsSync('icon.png')) {
    const iconStats = fs.statSync('icon.png');
    const iconSizeKB = Math.round(iconStats.size / 1024);

    if (iconSizeKB > 100) {
      console.warn(`⚠️  Large icon size: ${iconSizeKB}KB (recommended: < 100KB)`);
    } else {
      console.log(`✅ Icon size: ${iconSizeKB}KB`);
    }
  }

  console.log('🎉 Plugin structure validation passed!');

} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}