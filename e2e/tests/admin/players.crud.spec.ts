import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { ManageWrestlersPage } from '../../pages/admin/ManagePlayersPage';
import { adminCredentials } from '../../config/credentials';

test.describe('Wrestler CRUD Operations', () => {
  let loginPage: LoginPage;
  let wrestlersPage: ManageWrestlersPage;
  const timestamp = Date.now();
  const testWrestlerName = `E2E Test Wrestler ${timestamp}`;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    wrestlersPage = new ManageWrestlersPage(page);

    // Login before each test
    await loginPage.navigateToAdmin();
    await loginPage.login(adminCredentials.username, adminCredentials.password);
    await wrestlersPage.selectTab();
  });

  test('should display wrestlers list', async () => {
    const count = await wrestlersPage.getWrestlerCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should create a new wrestler', async () => {
    await wrestlersPage.createWrestler({
      name: testWrestlerName,
      wrestler: 'Stone Cold Steve Austin',
    });

    expect(await wrestlersPage.wrestlerExists(testWrestlerName)).toBe(true);
  });

  test('should delete a wrestler', async ({ page }) => {
    // First create a wrestler to delete
    const deleteTestWrestler = `Delete Test ${timestamp}`;
    await wrestlersPage.createWrestler({
      name: deleteTestWrestler,
      wrestler: 'The Undertaker',
    });

    expect(await wrestlersPage.wrestlerExists(deleteTestWrestler)).toBe(true);

    // Now delete it
    await wrestlersPage.deleteWrestler(deleteTestWrestler);

    // Refresh and verify deletion
    await page.reload();
    await wrestlersPage.selectTab();
    expect(await wrestlersPage.wrestlerExists(deleteTestWrestler)).toBe(false);
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup: delete test wrestler if it exists
    const page = await browser.newPage();
    const cleanup = new ManageWrestlersPage(page);
    const login = new LoginPage(page);

    await login.navigateToAdmin();
    await login.login(adminCredentials.username, adminCredentials.password);
    await cleanup.selectTab();

    if (await cleanup.wrestlerExists(testWrestlerName)) {
      await cleanup.deleteWrestler(testWrestlerName);
    }

    await page.close();
  });
});
