import {
  createCRMActivity,
  getCRMActivitiesContactById,
  handleCreateCRMActivity,
  handleUnlockCRMActivity,
  handleUpdateCRMActivity
} from '../crm.service.js'
import {
  executeQuery,
  persist,
  rcrActivityForContact
} from '@defra-fish/dynamics-lib'
import logger from '../../utils/logger-utils.js'

jest.mock('../../entities/index.js')
jest.mock('../../utils/logger-utils.js')

describe('crm.service.unit', () => {
  describe('handleCreateCRMActivity', () => {
    const mockContactId = 'contact-123'
    const mockSeason = '2024'

    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2026-03-04T12:12:33.353Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
      jest.clearAllMocks()
    })

    it('should not create an RCR CRM Activity if one already exists for the specified contact id and season', async () => {
      executeQuery.mockResolvedValue([{ id: 'existing' }])

      await handleCreateCRMActivity(mockContactId, mockSeason)

      expect(persist).not.toHaveBeenCalled()
      expect(logger.info).toHaveBeenNthCalledWith(
        3,
        'RCR CRM Activity already found for contactId=contact-123, season=2024 doing nothing'
      )
    })

    it('should create an RCR CRM activity if none exists for the specified contact id and season', async () => {
      executeQuery.mockResolvedValue([])
      persist.mockResolvedValueOnce(['abc-123'])

      await handleCreateCRMActivity(mockContactId, mockSeason)

      expect(persist).toHaveBeenCalledWith([
        {
          bindToEntity: expect.any(Function),
          season: '2024',
          startDate: new Date('2026-03-04T12:12:33.353Z'),
          status: 'STARTED'
        }
      ])
      expect(logger.info).toHaveBeenNthCalledWith(
        3,
        'No RCR CRM Activities found for contactId=contact-123, season=2024 creating now'
      )
    })

    it('should throw if persist fails', async () => {
      executeQuery.mockResolvedValue([])

      persist.mockRejectedValue(new Error('CRM failure'))

      await expect(
        handleCreateCRMActivity(mockContactId, mockSeason)
      ).rejects.toThrow('CRM failure')
    })

    it('should log error a helpful error message indicating that the devs should check the database and crm if persist fails', async () => {
      executeQuery.mockResolvedValue([])

      persist.mockRejectedValue(new Error('CRM failure'))

      await expect(
        handleCreateCRMActivity(mockContactId, mockSeason)
      ).rejects.toThrow()

      expect(logger.error).toHaveBeenCalledWith(
        `Error creating RCR CRM Activity for contactId=${mockContactId}, season=${mockSeason}, please check the database and crm to see if the details match`
      )
    })
  })

  describe('getCRMActivitiesContactById', () => {
    const mockContactId = 'contact-123'
    const mockSeason = '2024'

    it('should return RCR CRM Activities for the given contact id and season', async () => {
      const mockActivities = [{ id: 'activity1' }, { id: 'activity2' }]
      executeQuery.mockResolvedValue(mockActivities)

      const result = await getCRMActivitiesContactById(
        mockContactId,
        mockSeason
      )

      expect(rcrActivityForContact).toHaveBeenCalledWith(
        mockContactId,
        mockSeason
      )
      expect(result).toEqual(mockActivities)
    })

    it('should throw if executeQuery rejects', async () => {
      executeQuery.mockRejectedValue(new Error('Database failure'))

      await expect(
        getCRMActivitiesContactById(mockContactId, mockSeason)
      ).rejects.toThrow('Database failure')
    })
  })

  describe('createCRMActivity', () => {
    const mockContactId = 'contact-123'
    const mockSeason = '2024'

    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2026-03-04T12:12:33.353Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should persist a new RCRActivity', async () => {
      const mockPersistResult = [{ id: 'new-activity' }]
      persist.mockResolvedValue(mockPersistResult)

      await createCRMActivity(mockContactId, mockSeason)

      expect(persist).toHaveBeenCalledWith([
        expect.objectContaining({
          season: mockSeason,
          startDate: new Date('2026-03-04T12:12:33.353Z'),
          status: 'STARTED'
        })
      ])
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating RCR CRM Activity')
      )
    })

    it('should return the id of the newly created RCRActivity', async () => {
      const mockPersistResult = 'new-activity'
      persist.mockResolvedValue([mockPersistResult])

      const result = await createCRMActivity(mockContactId, mockSeason)

      expect(result).toBe(mockPersistResult)
    })

    it('should throw and log an error if persist fails', async () => {
      persist.mockRejectedValue(new Error('CRM failure'))

      await expect(
        createCRMActivity(mockContactId, mockSeason)
      ).rejects.toThrow('CRM failure')
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating RCR CRM Activity')
      )
    })
  })

  describe('handleUpdateCRMActivity', () => {
    const mockContactId = 'contact-123'
    const mockSeason = '2024'

    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2026-03-04T12:12:33.353Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
      jest.clearAllMocks()
    })

    it('should update the CRM activity when exactly one activity exists', async () => {
      const mockActivity = {
        entity: {
          id: 'activity-123',
          status: 'STARTED',
          submittedDate: null
        }
      }
      executeQuery.mockResolvedValue([mockActivity])
      persist.mockResolvedValue()

      await handleUpdateCRMActivity(mockContactId, mockSeason)

      expect(persist).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'activity-123',
          status: 'SUBMITTED',
          submittedDate: new Date('2026-03-04T12:12:33.353Z')
        })
      ])

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Updating RCR CRM Activities for: contactId=${mockContactId}, season=${mockSeason}`
        )
      )
    })

    it('should throw an error if no activities are found', async () => {
      executeQuery.mockResolvedValue([])

      await expect(
        handleUpdateCRMActivity(mockContactId, mockSeason)
      ).rejects.toThrow(
        `The number of RCR CRM Activities found for contactId=${mockContactId}, season=${mockSeason} is not 1 result=[]`
      )
    })

    it('should throw an error if more than one activity is found', async () => {
      const mockActivities = [
        { entity: { id: 'activity-1' } },
        { entity: { id: 'activity-2' } }
      ]

      executeQuery.mockResolvedValue(mockActivities)

      await expect(
        handleUpdateCRMActivity(mockContactId, mockSeason)
      ).rejects.toThrow(
        `The number of RCR CRM Activities found for contactId=${mockContactId}, season=${mockSeason} is not 1 result=${JSON.stringify(mockActivities)}`
      )
    })

    it('should log an error and throw if persist fails', async () => {
      const mockActivity = {
        entity: {
          id: 'activity-123',
          status: 'STARTED'
        }
      }

      executeQuery.mockResolvedValue([mockActivity])
      persist.mockRejectedValue(new Error('CRM failure'))

      await expect(
        handleUpdateCRMActivity(mockContactId, mockSeason)
      ).rejects.toThrow('CRM failure')

      expect(logger.error).toHaveBeenCalledWith(
        `Error updating RCR CRM Activity for contactId=${mockContactId}, season=${mockSeason}, please check the database and crm to see if the details match`
      )
    })
  })

  describe('handleUnlockCRMActivity', () => {
    const mockContactId = 'contact-123'
    const mockSeason = '2024'

    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2026-03-04T12:12:33.353Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
      jest.clearAllMocks()
    })

    it('should update the CRM activity when exactly one activity exists', async () => {
      const mockActivity = {
        entity: {
          id: 'activity-123',
          status: 'SUBMITTED',
          submittedDate: null
        }
      }
      executeQuery.mockResolvedValue([mockActivity])
      persist.mockResolvedValue()

      await handleUnlockCRMActivity(mockContactId, mockSeason)

      expect(persist).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'activity-123',
          status: 'STARTED',
          submittedDate: new Date('2026-03-04T12:12:33.353Z')
        })
      ])

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Updating RCR CRM Activities for: contactId=${mockContactId}, season=${mockSeason}`
        )
      )
    })

    it('should throw an error if no activities are found', async () => {
      executeQuery.mockResolvedValue([])

      await expect(
        handleUnlockCRMActivity(mockContactId, mockSeason)
      ).rejects.toThrow(
        `The number of RCR CRM Activities found for contactId=${mockContactId}, season=${mockSeason} is not 1 result=[]`
      )
    })

    it('should throw an error if more than one activity is found', async () => {
      const mockActivities = [
        { entity: { id: 'activity-1' } },
        { entity: { id: 'activity-2' } }
      ]

      executeQuery.mockResolvedValue(mockActivities)

      await expect(
        handleUnlockCRMActivity(mockContactId, mockSeason)
      ).rejects.toThrow(
        `The number of RCR CRM Activities found for contactId=${mockContactId}, season=${mockSeason} is not 1 result=${JSON.stringify(mockActivities)}`
      )
    })

    it('should log an error and throw if persist fails', async () => {
      const mockActivity = {
        entity: {
          id: 'activity-123',
          status: 'SUBMITTED'
        }
      }

      executeQuery.mockResolvedValue([mockActivity])
      persist.mockRejectedValue(new Error('CRM failure'))

      await expect(
        handleUnlockCRMActivity(mockContactId, mockSeason)
      ).rejects.toThrow('CRM failure')

      expect(logger.error).toHaveBeenCalledWith(
        `Error updating RCR CRM Activity for contactId=${mockContactId}, season=${mockSeason}, please check the database and crm to see if the details match`
      )
    })
  })
})
