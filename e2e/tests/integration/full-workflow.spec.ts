import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { ManageWrestlersPage } from '../../pages/admin/ManagePlayersPage';
import { ManageChampionshipsPage } from '../../pages/admin/ManageChampionshipsPage';
import { ManageDivisionsPage } from '../../pages/admin/ManageDivisionsPage';
import { ManageSeasonsPage } from '../../pages/admin/ManageSeasonsPage';
import { adminCredentials } from '../../config/credentials';

test.describe('Full Workflow Integration', () => {
  const timestamp = Date.now();
  const testData = {
    wrestler1: `E2E Wrestler 1 ${timestamp}`,
    wrestler2: `E2E Wrestler 2 ${timestamp}`,
    championship: `E2E Championship ${timestamp}`,
    division: `E2E Division ${timestamp}`,
    season: `E2E Season ${timestamp}`,
  };

  test('complete league management workflow', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const wrestlersPage = new ManageWrestlersPage(page);
    const championshipsPage = new ManageChampionshipsPage(page);
    const divisionsPage = new ManageDivisionsPage(page);
    const seasonsPage = new ManageSeasonsPage(page);

    // Step 1: Login
    console.log('Step 1: Logging in...');
    await loginPage.navigateToAdmin();
    await loginPage.login(adminCredentials.username, adminCredentials.password);
    expect(await loginPage.isLoggedIn()).toBe(true);
    console.log('Login successful');

    // Step 2: Create a Division
    console.log('Step 2: Creating division...');
    await divisionsPage.selectTab();
    await divisionsPage.createDivision({
      name: testData.division,
      description: 'Test division for E2E workflow',
    });
    expect(await divisionsPage.divisionExists(testData.division)).toBe(true);
    console.log('Division created');

    // Step 3: Create Wrestlers
    console.log('Step 3: Creating wrestlers...');
    await wrestlersPage.selectTab();
    await wrestlersPage.createWrestler({
      name: testData.wrestler1,
      wrestler: 'Stone Cold Steve Austin',
    });
    await wrestlersPage.createWrestler({
      name: testData.wrestler2,
      wrestler: 'The Rock',
    });
    expect(await wrestlersPage.wrestlerExists(testData.wrestler1)).toBe(true);
    expect(await wrestlersPage.wrestlerExists(testData.wrestler2)).toBe(true);
    console.log('Wrestlers created');

    // Step 4: Create Championship
    console.log('Step 4: Creating championship...');
    await championshipsPage.selectTab();
    await championshipsPage.createChampionship({
      name: testData.championship,
      type: 'singles',
    });
    expect(await championshipsPage.championshipExists(testData.championship)).toBe(true);
    console.log('Championship created');

    // Step 5: Create Season (if no active season)
    console.log('Step 5: Managing season...');
    await seasonsPage.selectTab();
    if (await seasonsPage.hasActiveSeason()) {
      console.log('Active season exists, skipping season creation');
    } else {
      const today = new Date().toISOString().split('T')[0];
      await seasonsPage.createSeason({
        name: testData.season,
        startDate: today,
      });
      expect(await seasonsPage.hasActiveSeason()).toBe(true);
      console.log('Season created');
    }

    // Cleanup
    console.log('Cleaning up test data...');

    // Delete championship
    await championshipsPage.selectTab();
    await championshipsPage.deleteChampionship(testData.championship);
    console.log('Championship deleted');

    // Delete wrestlers
    await wrestlersPage.selectTab();
    await wrestlersPage.deleteWrestler(testData.wrestler1);
    await wrestlersPage.deleteWrestler(testData.wrestler2);
    console.log('Wrestlers deleted');

    // Delete division
    await divisionsPage.selectTab();
    await divisionsPage.deleteDivision(testData.division);
    console.log('Division deleted');

    // End and delete test season if we created it
    await seasonsPage.selectTab();
    if (await seasonsPage.seasonExists(testData.season)) {
      if (await seasonsPage.hasActiveSeason()) {
        await seasonsPage.endActiveSeason();
      }
      await seasonsPage.deleteSeason(testData.season);
      console.log('Season deleted');
    }

    console.log('Full workflow completed successfully!');
  });
});
